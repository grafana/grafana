import * as queryDef from './query_def';

export class ElasticQueryBuilder {
  timeField: string;
  esVersion: number;

  constructor(options) {
    this.timeField = options.timeField;
    this.esVersion = options.esVersion;
  }

  getRangeFilter() {
    const filter = {};
    filter[this.timeField] = {
      gte: '$timeFrom',
      lte: '$timeTo',
      format: 'epoch_millis',
    };

    return filter;
  }

  buildTermsAgg(aggDef, queryNode, target) {
    let metricRef, metric, y;
    queryNode.terms = { field: aggDef.field };

    if (!aggDef.settings) {
      return queryNode;
    }

    queryNode.terms.size = parseInt(aggDef.settings.size, 10) === 0 ? 500 : parseInt(aggDef.settings.size, 10);
    if (aggDef.settings.orderBy !== void 0) {
      queryNode.terms.order = {};
      if (aggDef.settings.orderBy === '_term' && this.esVersion >= 60) {
        queryNode.terms.order['_key'] = aggDef.settings.order;
      } else {
        queryNode.terms.order[aggDef.settings.orderBy] = aggDef.settings.order;
      }

      // if metric ref, look it up and add it to this agg level
      metricRef = parseInt(aggDef.settings.orderBy, 10);
      if (!isNaN(metricRef)) {
        for (y = 0; y < target.metrics.length; y++) {
          metric = target.metrics[y];
          if (metric.id === aggDef.settings.orderBy) {
            queryNode.aggs = {};
            queryNode.aggs[metric.id] = {};
            queryNode.aggs[metric.id][metric.type] = { field: metric.field };
            break;
          }
        }
      }
    }

    if (aggDef.settings.min_doc_count !== void 0) {
      queryNode.terms.min_doc_count = parseInt(aggDef.settings.min_doc_count, 10);
    }

    if (aggDef.settings.missing) {
      queryNode.terms.missing = aggDef.settings.missing;
    }

    return queryNode;
  }

  getDateHistogramAgg(aggDef) {
    const esAgg: any = {};
    const settings = aggDef.settings || {};
    esAgg.interval = settings.interval;
    esAgg.field = this.timeField;
    esAgg.min_doc_count = settings.min_doc_count || 0;
    esAgg.extended_bounds = { min: '$timeFrom', max: '$timeTo' };
    esAgg.format = 'epoch_millis';

    if (esAgg.interval === 'auto') {
      esAgg.interval = '$__interval';
    }

    if (settings.missing) {
      esAgg.missing = settings.missing;
    }

    return esAgg;
  }

  getHistogramAgg(aggDef) {
    const esAgg: any = {};
    const settings = aggDef.settings || {};
    esAgg.interval = settings.interval;
    esAgg.field = aggDef.field;
    esAgg.min_doc_count = settings.min_doc_count || 0;

    if (settings.missing) {
      esAgg.missing = settings.missing;
    }
    return esAgg;
  }

  getFiltersAgg(aggDef) {
    const filterObj = {};
    for (let i = 0; i < aggDef.settings.filters.length; i++) {
      const query = aggDef.settings.filters[i].query;
      let label = aggDef.settings.filters[i].label;
      label = label === '' || label === undefined ? query : label;
      filterObj[label] = {
        query_string: {
          query: query,
          analyze_wildcard: true,
        },
      };
    }

    return filterObj;
  }

  documentQuery(query, size) {
    query.size = size;
    query.sort = {};
    query.sort[this.timeField] = { order: 'desc', unmapped_type: 'boolean' };

    // fields field not supported on ES 5.x
    if (this.esVersion < 5) {
      query.fields = ['*', '_source'];
    }

    query.script_fields = {};
    if (this.esVersion < 5) {
      query.fielddata_fields = [this.timeField];
    } else {
      query.docvalue_fields = [this.timeField];
    }
    return query;
  }

  addAdhocFilters(query, adhocFilters) {
    if (!adhocFilters) {
      return;
    }

    let i, filter, condition, queryCondition;

    for (i = 0; i < adhocFilters.length; i++) {
      filter = adhocFilters[i];
      condition = {};
      condition[filter.key] = filter.value;
      queryCondition = {};
      queryCondition[filter.key] = { query: filter.value };

      switch (filter.operator) {
        case '=':
          if (!query.query.bool.must) {
            query.query.bool.must = [];
          }
          query.query.bool.must.push({ match_phrase: queryCondition });
          break;
        case '!=':
          if (!query.query.bool.must_not) {
            query.query.bool.must_not = [];
          }
          query.query.bool.must_not.push({ match_phrase: queryCondition });
          break;
        case '<':
          condition[filter.key] = { lt: filter.value };
          query.query.bool.filter.push({ range: condition });
          break;
        case '>':
          condition[filter.key] = { gt: filter.value };
          query.query.bool.filter.push({ range: condition });
          break;
        case '=~':
          query.query.bool.filter.push({ regexp: condition });
          break;
        case '!~':
          query.query.bool.filter.push({
            bool: { must_not: { regexp: condition } },
          });
          break;
      }
    }
  }

  build(target, adhocFilters?, queryString?) {
    // make sure query has defaults;
    target.metrics = target.metrics || [queryDef.defaultMetricAgg()];
    target.bucketAggs = target.bucketAggs || [queryDef.defaultBucketAgg()];
    target.timeField = this.timeField;

    let i, nestedAggs, metric;
    const query = {
      size: 0,
      query: {
        bool: {
          filter: [
            { range: this.getRangeFilter() },
            {
              query_string: {
                analyze_wildcard: true,
                query: queryString,
              },
            },
          ],
        },
      },
    };

    this.addAdhocFilters(query, adhocFilters);

    // handle document query
    if (target.bucketAggs.length === 0) {
      metric = target.metrics[0];
      if (!metric || metric.type !== 'raw_document') {
        throw { message: 'Invalid query' };
      }

      const size = (metric.settings && metric.settings.size) || 500;
      return this.documentQuery(query, size);
    }

    nestedAggs = query;

    for (i = 0; i < target.bucketAggs.length; i++) {
      const aggDef = target.bucketAggs[i];
      const esAgg = {};

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
            precision: aggDef.settings.precision,
          };
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

      const aggField = {};
      let metricAgg = null;

      if (queryDef.isPipelineAgg(metric.type)) {
        if (metric.pipelineAgg && /^\d*$/.test(metric.pipelineAgg)) {
          metricAgg = { buckets_path: metric.pipelineAgg };
        } else {
          continue;
        }
      } else {
        metricAgg = { field: metric.field };
      }

      for (const prop in metric.settings) {
        if (metric.settings.hasOwnProperty(prop) && metric.settings[prop] !== null) {
          metricAgg[prop] = metric.settings[prop];
        }
      }

      aggField[metric.type] = metricAgg;
      nestedAggs.aggs[metric.id] = aggField;
    }

    return query;
  }

  getTermsQuery(queryDef) {
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
          order: {
            _term: 'asc',
          },
        },
      },
    };

    if (this.esVersion >= 60) {
      query.aggs['1'].terms.order = {
        _key: 'asc',
      };
    }

    return query;
  }
}
