import { InternalTimeZones } from '@grafana/data';

import {
  isMetricAggregationWithField,
  isMetricAggregationWithSettings,
  isMovingAverageWithModelSettings,
  isPipelineAggregation,
  isPipelineAggregationWithMultipleBucketPaths,
} from './components/QueryEditor/MetricAggregationsEditor/aggregations';
import { defaultBucketAgg, defaultMetricAgg, findMetricById, highlightTags } from './queryDef';
import {
  ElasticsearchQuery,
  TermsQuery,
  Filters,
  Terms,
  MetricAggregation,
  MetricAggregationWithInlineScript,
  Histogram,
  DateHistogram,
} from './types';
import { convertOrderByToMetricId, getScriptValue } from './utils';

export class ElasticQueryBuilder {
  timeField: string;

  constructor(options: { timeField: string }) {
    this.timeField = options.timeField;
  }

  getRangeFilter() {
    const filter: any = {};
    filter[this.timeField] = {
      gte: '$timeFrom',
      lte: '$timeTo',
      format: 'epoch_millis',
    };

    return filter;
  }

  buildTermsAgg(aggDef: Terms, queryNode: { terms?: any; aggs?: any }, target: ElasticsearchQuery) {
    queryNode.terms = { field: aggDef.field };

    if (!aggDef.settings) {
      return queryNode;
    }

    // TODO: This default should be somewhere else together with the one used in the UI
    const size = aggDef.settings?.size ? parseInt(aggDef.settings.size, 10) : 500;
    queryNode.terms.size = size === 0 ? 500 : size;

    if (aggDef.settings.orderBy !== void 0) {
      queryNode.terms.order = {};
      if (aggDef.settings.orderBy === '_term') {
        queryNode.terms.order['_key'] = aggDef.settings.order;
      } else {
        queryNode.terms.order[aggDef.settings.orderBy] = aggDef.settings.order;
      }

      // if metric ref, look it up and add it to this agg level
      const metricId = convertOrderByToMetricId(aggDef.settings.orderBy);
      if (metricId) {
        for (let metric of target.metrics || []) {
          if (metric.id === metricId) {
            if (metric.type === 'count') {
              queryNode.terms.order = { _count: aggDef.settings.order };
            } else if (isMetricAggregationWithField(metric)) {
              queryNode.aggs = {};
              queryNode.aggs[metric.id] = {
                [metric.type]: { field: metric.field },
              };
            }
            break;
          }
        }
      }
    }

    if (aggDef.settings.min_doc_count !== void 0) {
      queryNode.terms.min_doc_count = parseInt(aggDef.settings.min_doc_count, 10);

      if (isNaN(queryNode.terms.min_doc_count)) {
        queryNode.terms.min_doc_count = aggDef.settings.min_doc_count;
      }
    }

    if (aggDef.settings.missing) {
      queryNode.terms.missing = aggDef.settings.missing;
    }

    return queryNode;
  }

  getDateHistogramAgg(aggDef: DateHistogram) {
    const esAgg: any = {};
    const settings = aggDef.settings || {};

    esAgg.field = aggDef.field || this.timeField;
    esAgg.min_doc_count = settings.min_doc_count || 0;
    esAgg.extended_bounds = { min: '$timeFrom', max: '$timeTo' };
    esAgg.format = 'epoch_millis';
    if (settings.timeZone && settings.timeZone !== InternalTimeZones.utc) {
      esAgg.time_zone = settings.timeZone;
    }

    if (settings.offset !== '') {
      esAgg.offset = settings.offset;
    }

    const interval = settings.interval === 'auto' ? '${__interval_ms}ms' : settings.interval;

    esAgg.fixed_interval = interval;

    return esAgg;
  }

  getHistogramAgg(aggDef: Histogram) {
    const esAgg: any = {};
    const settings = aggDef.settings || {};
    esAgg.interval = settings.interval;
    esAgg.field = aggDef.field;
    esAgg.min_doc_count = settings.min_doc_count || 0;

    return esAgg;
  }

  getFiltersAgg(aggDef: Filters) {
    const filterObj: Record<string, { query_string: { query: string; analyze_wildcard: boolean } }> = {};

    for (let { query, label } of aggDef.settings?.filters || []) {
      filterObj[label || query] = {
        query_string: {
          query: query,
          analyze_wildcard: true,
        },
      };
    }

    return filterObj;
  }

  documentQuery(query: any, size: number) {
    query.size = size;
    query.sort = [
      {
        [this.timeField]: { order: 'desc', unmapped_type: 'boolean' },
      },
      {
        _doc: { order: 'desc' },
      },
    ];

    query.script_fields = {};
    return query;
  }

  build(target: ElasticsearchQuery) {
    // make sure query has defaults;
    target.metrics = target.metrics || [defaultMetricAgg()];
    target.bucketAggs = target.bucketAggs || [defaultBucketAgg()];
    target.timeField = this.timeField;
    let metric: MetricAggregation;

    let i, j, pv, nestedAggs;
    const query: any = {
      size: 0,
      query: {
        bool: {
          filter: [{ range: this.getRangeFilter() }],
        },
      },
    };

    if (target.query && target.query !== '') {
      query.query.bool.filter = [
        ...query.query.bool.filter,
        {
          query_string: {
            analyze_wildcard: true,
            query: target.query,
          },
        },
      ];
    }

    // If target doesn't have bucketAggs and type is not raw_document, it is invalid query.
    if (target.bucketAggs.length === 0) {
      metric = target.metrics[0];

      if (!metric || !(metric.type === 'raw_document' || metric.type === 'raw_data')) {
        throw { message: 'Invalid query' };
      }
    }

    /* Handle document query:
     * Check if metric type is raw_document. If metric doesn't have size (or size is 0), update size to 500.
     * Otherwise it will not be a valid query and error will be thrown.
     */
    if (target.metrics?.[0]?.type === 'raw_document' || target.metrics?.[0]?.type === 'raw_data') {
      metric = target.metrics[0];

      // TODO: This default should be somewhere else together with the one used in the UI
      const size = metric.settings?.size ? parseInt(metric.settings.size, 10) : 500;

      return this.documentQuery(query, size || 500);
    }

    nestedAggs = query;

    for (i = 0; i < target.bucketAggs.length; i++) {
      const aggDef = target.bucketAggs[i];
      const esAgg: any = {};

      switch (aggDef.type) {
        case 'date_histogram': {
          esAgg['date_histogram'] = this.getDateHistogramAgg(aggDef);
          break;
        }
        case 'histogram': {
          esAgg['histogram'] = this.getHistogramAgg(aggDef);
          break;
        }
        case 'filters': {
          esAgg['filters'] = { filters: this.getFiltersAgg(aggDef) };
          break;
        }
        case 'terms': {
          this.buildTermsAgg(aggDef, esAgg, target);
          break;
        }
        case 'geohash_grid': {
          esAgg['geohash_grid'] = {
            field: aggDef.field,
            precision: aggDef.settings?.precision,
          };
          break;
        }
        case 'nested': {
          esAgg['nested'] = { path: aggDef.field };
          break;
        }
      }

      nestedAggs.aggs = nestedAggs.aggs || {};
      nestedAggs.aggs[aggDef.id] = esAgg;
      nestedAggs = esAgg;
    }

    nestedAggs.aggs = {};

    for (i = 0; i < target.metrics.length; i++) {
      metric = target.metrics[i];
      if (metric.type === 'count') {
        continue;
      }

      const aggField: any = {};
      let metricAgg: any = {};

      if (isPipelineAggregation(metric)) {
        if (isPipelineAggregationWithMultipleBucketPaths(metric)) {
          if (metric.pipelineVariables) {
            metricAgg = {
              buckets_path: {},
            };

            for (j = 0; j < metric.pipelineVariables.length; j++) {
              pv = metric.pipelineVariables[j];

              if (pv.name && pv.pipelineAgg && /^\d*$/.test(pv.pipelineAgg)) {
                const appliedAgg = findMetricById(target.metrics, pv.pipelineAgg);
                if (appliedAgg) {
                  if (appliedAgg.type === 'count') {
                    metricAgg.buckets_path[pv.name] = '_count';
                  } else {
                    metricAgg.buckets_path[pv.name] = pv.pipelineAgg;
                  }
                }
              }
            }
          } else {
            continue;
          }
        } else {
          if (metric.field && /^\d*$/.test(metric.field)) {
            const appliedAgg = findMetricById(target.metrics, metric.field);
            if (appliedAgg) {
              if (appliedAgg.type === 'count') {
                metricAgg = { buckets_path: '_count' };
              } else {
                metricAgg = { buckets_path: metric.field };
              }
            }
          } else {
            continue;
          }
        }
      } else if (isMetricAggregationWithField(metric)) {
        metricAgg = { field: metric.field };
      }

      if (isMetricAggregationWithSettings(metric)) {
        Object.entries(metric.settings || {})
          .filter(([_, v]) => v !== null)
          .forEach(([k, v]) => {
            metricAgg[k] =
              k === 'script' ? this.buildScript(getScriptValue(metric as MetricAggregationWithInlineScript)) : v;
          });

        // Elasticsearch isn't generally too picky about the data types in the request body,
        // however some fields are required to be numeric.
        // Users might have already created some of those with before, where the values were numbers.
        switch (metric.type) {
          case 'moving_avg':
            metricAgg = {
              ...metricAgg,
              ...(metricAgg?.window !== undefined && { window: this.toNumber(metricAgg.window) }),
              ...(metricAgg?.predict !== undefined && { predict: this.toNumber(metricAgg.predict) }),
              ...(isMovingAverageWithModelSettings(metric) && {
                settings: {
                  ...metricAgg.settings,
                  ...Object.fromEntries(
                    Object.entries(metricAgg.settings || {})
                      // Only format properties that are required to be numbers
                      .filter(([settingName]) => ['alpha', 'beta', 'gamma', 'period'].includes(settingName))
                      // omitting undefined
                      .filter(([_, stringValue]) => stringValue !== undefined)
                      .map(([_, stringValue]) => [_, this.toNumber(stringValue)])
                  ),
                },
              }),
            };
            break;

          case 'serial_diff':
            metricAgg = {
              ...metricAgg,
              ...(metricAgg.lag !== undefined && {
                lag: this.toNumber(metricAgg.lag),
              }),
            };
            break;

          case 'top_metrics':
            metricAgg = {
              metrics: metric.settings?.metrics?.map((field) => ({ field })),
              size: 1,
            };

            if (metric.settings?.orderBy) {
              metricAgg.sort = [{ [metric.settings?.orderBy]: metric.settings?.order }];
            }
            break;
        }
      }

      aggField[metric.type] = metricAgg;
      nestedAggs.aggs[metric.id] = aggField;
    }

    return query;
  }

  private buildScript(script: string) {
    return script;
  }

  private toNumber(stringValue: unknown): unknown | number {
    const parsedValue = parseFloat(`${stringValue}`);
    if (isNaN(parsedValue)) {
      return stringValue;
    }

    return parsedValue;
  }

  getTermsQuery(queryDef: TermsQuery) {
    const query: any = {
      size: 0,
      query: {
        bool: {
          filter: [{ range: this.getRangeFilter() }],
        },
      },
    };

    if (queryDef.query) {
      query.query.bool.filter.push({
        query_string: {
          analyze_wildcard: true,
          query: queryDef.query,
        },
      });
    }

    let size = 500;
    if (queryDef.size) {
      size = queryDef.size;
    }

    query.aggs = {
      '1': {
        terms: {
          field: queryDef.field,
          size: size,
          order: {},
        },
      },
    };

    // Default behaviour is to order results by { _key: asc }
    // queryDef.order allows selection of asc/desc
    // queryDef.orderBy allows selection of doc_count ordering (defaults desc)

    const { orderBy = 'key', order = orderBy === 'doc_count' ? 'desc' : 'asc' } = queryDef;

    if (['asc', 'desc'].indexOf(order) < 0) {
      throw { message: `Invalid query sort order ${order}` };
    }

    switch (orderBy) {
      case 'key':
      case 'term':
        const keyname = '_key';
        query.aggs['1'].terms.order[keyname] = order;
        break;
      case 'doc_count':
        query.aggs['1'].terms.order['_count'] = order;
        break;
      default:
        throw { message: `Invalid query sort type ${orderBy}` };
    }

    return query;
  }

  getLogsQuery(target: ElasticsearchQuery, limit: number) {
    let query: any = {
      size: 0,
      query: {
        bool: {
          filter: [{ range: this.getRangeFilter() }],
        },
      },
    };

    if (target.query) {
      query.query.bool.filter.push({
        query_string: {
          analyze_wildcard: true,
          query: target.query,
        },
      });
    }

    query = this.documentQuery(query, limit);

    return {
      ...query,
      aggs: this.build(target).aggs,
      highlight: {
        fields: {
          '*': {},
        },
        pre_tags: [highlightTags.pre],
        post_tags: [highlightTags.post],
        fragment_size: 2147483647,
      },
    };
  }
}
