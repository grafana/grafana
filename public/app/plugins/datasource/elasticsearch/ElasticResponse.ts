import { clone, filter, find, identity, isArray, keys, map, uniq, values as _values } from 'lodash';

import {
  DataQueryResponse,
  DataFrame,
  toDataFrame,
  FieldType,
  MutableDataFrame,
  PreferredVisualisationType,
} from '@grafana/data';
import TableModel from 'app/core/TableModel';
import flatten from 'app/core/utils/flatten';

import { isMetricAggregationWithField } from './components/QueryEditor/MetricAggregationsEditor/aggregations';
import { metricAggregationConfig } from './components/QueryEditor/MetricAggregationsEditor/utils';
import * as queryDef from './queryDef';
import { ElasticsearchAggregation, ElasticsearchQuery, TopMetrics, ExtendedStatMetaType } from './types';
import { describeMetric, getScriptValue } from './utils';

const HIGHLIGHT_TAGS_EXP = `${queryDef.highlightTags.pre}([^@]+)${queryDef.highlightTags.post}`;
type TopMetricMetric = Record<string, number>;
interface TopMetricBucket {
  top: Array<{
    metrics: TopMetricMetric;
  }>;
}

export class ElasticResponse {
  constructor(private targets: ElasticsearchQuery[], private response: any) {
    this.targets = targets;
    this.response = response;
  }

  processMetrics(esAgg: any, target: ElasticsearchQuery, seriesList: any, props: any) {
    let newSeries: any;

    for (let y = 0; y < target.metrics!.length; y++) {
      const metric = target.metrics![y];
      if (metric.hide) {
        continue;
      }

      switch (metric.type) {
        case 'count': {
          newSeries = { datapoints: [], metric: 'count', props, refId: target.refId };
          for (let i = 0; i < esAgg.buckets.length; i++) {
            const bucket = esAgg.buckets[i];
            const value = bucket.doc_count;
            newSeries.datapoints.push([value, bucket.key]);
          }
          seriesList.push(newSeries);
          break;
        }
        case 'percentiles': {
          if (esAgg.buckets.length === 0) {
            break;
          }

          const firstBucket = esAgg.buckets[0];
          const percentiles = firstBucket[metric.id].values;

          for (const percentileName in percentiles) {
            newSeries = {
              datapoints: [],
              metric: 'p' + percentileName,
              props: props,
              field: metric.field,
              refId: target.refId,
            };

            for (let i = 0; i < esAgg.buckets.length; i++) {
              const bucket = esAgg.buckets[i];
              const values = bucket[metric.id].values;
              newSeries.datapoints.push([values[percentileName], bucket.key]);
            }
            seriesList.push(newSeries);
          }

          break;
        }
        case 'extended_stats': {
          for (const statName in metric.meta) {
            if (!metric.meta[statName as ExtendedStatMetaType]) {
              continue;
            }

            newSeries = {
              datapoints: [],
              metric: statName,
              props: props,
              field: metric.field,
              refId: target.refId,
            };

            for (let i = 0; i < esAgg.buckets.length; i++) {
              const bucket = esAgg.buckets[i];
              const stats = bucket[metric.id];

              // add stats that are in nested obj to top level obj
              stats.std_deviation_bounds_upper = stats.std_deviation_bounds.upper;
              stats.std_deviation_bounds_lower = stats.std_deviation_bounds.lower;

              newSeries.datapoints.push([stats[statName], bucket.key]);
            }

            seriesList.push(newSeries);
          }

          break;
        }
        case 'top_metrics': {
          if (metric.settings?.metrics?.length) {
            for (const metricField of metric.settings?.metrics) {
              newSeries = {
                datapoints: [],
                metric: metric.type,
                props: props,
                refId: target.refId,
                field: metricField,
              };
              for (let i = 0; i < esAgg.buckets.length; i++) {
                const bucket = esAgg.buckets[i];
                const stats = bucket[metric.id] as TopMetricBucket;
                const values = stats.top.map((hit) => {
                  if (hit.metrics[metricField]) {
                    return hit.metrics[metricField];
                  }
                  return null;
                });
                const point = [values[values.length - 1], bucket.key];
                newSeries.datapoints.push(point);
              }
              seriesList.push(newSeries);
            }
          }
          break;
        }
        default: {
          newSeries = {
            datapoints: [],
            metric: metric.type,
            metricId: metric.id,
            props: props,
            refId: target.refId,
          };

          if (isMetricAggregationWithField(metric)) {
            newSeries.field = metric.field;
          }

          for (let i = 0; i < esAgg.buckets.length; i++) {
            const bucket = esAgg.buckets[i];
            const value = bucket[metric.id];

            if (value !== undefined) {
              if (value.normalized_value) {
                newSeries.datapoints.push([value.normalized_value, bucket.key]);
              } else {
                newSeries.datapoints.push([value.value, bucket.key]);
              }
            }
          }
          seriesList.push(newSeries);
          break;
        }
      }
    }
  }

  processAggregationDocs(
    esAgg: any,
    aggDef: ElasticsearchAggregation,
    target: ElasticsearchQuery,
    table: any,
    props: any
  ) {
    // add columns
    if (table.columns.length === 0) {
      for (const propKey of keys(props)) {
        table.addColumn({ text: propKey, filterable: true });
      }
      table.addColumn({ text: aggDef.field, filterable: true });
    }

    // helper func to add values to value array
    const addMetricValue = (values: any[], metricName: string, value: any) => {
      table.addColumn({ text: metricName });
      values.push(value);
    };
    const buckets = isArray(esAgg.buckets) ? esAgg.buckets : [esAgg.buckets];
    for (const bucket of buckets) {
      const values = [];

      for (const propValues of _values(props)) {
        values.push(propValues);
      }

      // add bucket key (value)
      values.push(bucket.key);

      for (const metric of target.metrics || []) {
        switch (metric.type) {
          case 'count': {
            addMetricValue(values, this.getMetricName(metric.type), bucket.doc_count);
            break;
          }
          case 'extended_stats': {
            for (const statName in metric.meta) {
              if (!metric.meta[statName as ExtendedStatMetaType]) {
                continue;
              }

              const stats = bucket[metric.id];
              // add stats that are in nested obj to top level obj
              stats.std_deviation_bounds_upper = stats.std_deviation_bounds.upper;
              stats.std_deviation_bounds_lower = stats.std_deviation_bounds.lower;

              addMetricValue(values, this.getMetricName(statName as ExtendedStatMetaType), stats[statName]);
            }
            break;
          }
          case 'percentiles': {
            const percentiles = bucket[metric.id].values;

            for (const percentileName in percentiles) {
              addMetricValue(values, `p${percentileName} ${metric.field}`, percentiles[percentileName]);
            }
            break;
          }
          case 'top_metrics': {
            const baseName = this.getMetricName(metric.type);

            if (metric.settings?.metrics) {
              for (const metricField of metric.settings.metrics) {
                // If we selected more than one metric we also add each metric name
                const metricName = metric.settings.metrics.length > 1 ? `${baseName} ${metricField}` : baseName;

                const stats = bucket[metric.id] as TopMetricBucket;

                // Size of top_metrics is fixed to 1.
                addMetricValue(values, metricName, stats.top[0].metrics[metricField]);
              }
            }

            break;
          }
          default: {
            let metricName = this.getMetricName(metric.type);
            const otherMetrics = filter(target.metrics, { type: metric.type });

            // if more of the same metric type include field field name in property
            if (otherMetrics.length > 1) {
              if (isMetricAggregationWithField(metric)) {
                metricName += ' ' + metric.field;
              }

              if (metric.type === 'bucket_script') {
                //Use the formula in the column name
                metricName = getScriptValue(metric);
              }
            }

            addMetricValue(values, metricName, bucket[metric.id].value);
            break;
          }
        }
      }

      table.rows.push(values);
    }
  }

  // This is quite complex
  // need to recurse down the nested buckets to build series
  processBuckets(aggs: any, target: ElasticsearchQuery, seriesList: any, table: TableModel, props: any, depth: number) {
    let bucket, aggDef: any, esAgg, aggId;
    const maxDepth = target.bucketAggs!.length - 1;

    for (aggId in aggs) {
      aggDef = find(target.bucketAggs, { id: aggId });
      esAgg = aggs[aggId];

      if (!aggDef) {
        continue;
      }

      if (aggDef.type === 'nested') {
        this.processBuckets(esAgg, target, seriesList, table, props, depth + 1);
        continue;
      }

      if (depth === maxDepth) {
        if (aggDef.type === 'date_histogram') {
          this.processMetrics(esAgg, target, seriesList, props);
        } else {
          this.processAggregationDocs(esAgg, aggDef, target, table, props);
        }
      } else {
        for (const nameIndex in esAgg.buckets) {
          bucket = esAgg.buckets[nameIndex];
          props = clone(props);
          if (bucket.key !== void 0) {
            props[aggDef.field] = bucket.key;
          } else {
            props['filter'] = nameIndex;
          }
          if (bucket.key_as_string) {
            props[aggDef.field] = bucket.key_as_string;
          }
          this.processBuckets(bucket, target, seriesList, table, props, depth + 1);
        }
      }
    }
  }

  private getMetricName(metric: string): string {
    const metricDef = Object.entries(metricAggregationConfig)
      .filter(([key]) => key === metric)
      .map(([_, value]) => value)[0];

    if (metricDef) {
      return metricDef.label;
    }

    const extendedStat = queryDef.extendedStats.find((e) => e.value === metric);
    if (extendedStat) {
      return extendedStat.label;
    }

    return metric;
  }

  private getSeriesName(series: any, target: ElasticsearchQuery, dedup: boolean) {
    let metricName = this.getMetricName(series.metric);

    if (target.alias) {
      const regex = /\{\{([\s\S]+?)\}\}/g;

      return target.alias.replace(regex, (match: any, g1: any, g2: any) => {
        const group = g1 || g2;

        if (group.indexOf('term ') === 0) {
          return series.props[group.substring(5)];
        }
        if (series.props[group] !== void 0) {
          return series.props[group];
        }
        if (group === 'metric') {
          return metricName;
        }
        if (group === 'field') {
          return series.field || '';
        }

        return match;
      });
    }

    if (queryDef.isPipelineAgg(series.metric)) {
      if (series.metric && queryDef.isPipelineAggWithMultipleBucketPaths(series.metric)) {
        const agg: any = find(target.metrics, { id: series.metricId });
        if (agg && agg.settings.script) {
          metricName = getScriptValue(agg);

          for (const pv of agg.pipelineVariables) {
            const appliedAgg: any = find(target.metrics, { id: pv.pipelineAgg });
            if (appliedAgg) {
              metricName = metricName.replace('params.' + pv.name, describeMetric(appliedAgg));
            }
          }
        } else {
          metricName = 'Unset';
        }
      } else {
        const appliedAgg: any = find(target.metrics, { id: series.field });
        if (appliedAgg) {
          metricName += ' ' + describeMetric(appliedAgg);
        } else {
          metricName = 'Unset';
        }
      }
    } else if (series.field) {
      metricName += ' ' + series.field;
    }

    const propKeys = keys(series.props);
    if (propKeys.length === 0) {
      return metricName;
    }

    let name = '';
    for (const propName in series.props) {
      name += series.props[propName] + ' ';
    }

    if (dedup) {
      return name.trim() + ' ' + metricName;
    }

    return name.trim();
  }

  nameSeries(seriesList: any, target: ElasticsearchQuery) {
    const metricTypeCount = uniq(map(seriesList, 'metric')).length;
    const hasTopMetricWithMultipleMetrics = (
      target.metrics?.filter((m) => m.type === 'top_metrics') as TopMetrics[]
    ).some((m) => (m?.settings?.metrics?.length || 0) > 1);

    for (let i = 0; i < seriesList.length; i++) {
      const series = seriesList[i];
      series.target = this.getSeriesName(series, target, metricTypeCount > 1 || hasTopMetricWithMultipleMetrics);
    }
  }

  processHits(hits: { total: { value: any }; hits: any[] }, seriesList: any[], target: ElasticsearchQuery) {
    const hitsTotal = typeof hits.total === 'number' ? hits.total : hits.total.value; // <- Works with Elasticsearch 7.0+

    const series: any = {
      target: target.refId,
      type: 'docs',
      refId: target.refId,
      datapoints: [],
      total: hitsTotal,
      filterable: true,
    };
    let propName, hit, doc: any, i;

    for (i = 0; i < hits.hits.length; i++) {
      hit = hits.hits[i];
      doc = {
        _id: hit._id,
        _type: hit._type,
        _index: hit._index,
        sort: hit.sort,
        highlight: hit.highlight,
      };

      if (hit._source) {
        for (propName in hit._source) {
          doc[propName] = hit._source[propName];
        }
      }

      for (propName in hit.fields) {
        doc[propName] = hit.fields[propName];
      }
      series.datapoints.push(doc);
    }

    seriesList.push(series);
  }

  trimDatapoints(aggregations: any, target: ElasticsearchQuery) {
    const histogram: any = find(target.bucketAggs, { type: 'date_histogram' });

    const shouldDropFirstAndLast = histogram && histogram.settings && histogram.settings.trimEdges;
    if (shouldDropFirstAndLast) {
      const trim = histogram.settings.trimEdges;
      for (const prop in aggregations) {
        const points = aggregations[prop];
        if (points.datapoints.length > trim * 2) {
          points.datapoints = points.datapoints.slice(trim, points.datapoints.length - trim);
        }
      }
    }
  }

  getErrorFromElasticResponse(response: any, err: any) {
    const result: any = {};
    result.data = JSON.stringify(err, null, 4);
    if (err.root_cause && err.root_cause.length > 0 && err.root_cause[0].reason) {
      result.message = err.root_cause[0].reason;
    } else {
      result.message = err.reason || 'Unknown elastic error response';
    }

    if (response.$$config) {
      result.config = response.$$config;
    }

    return result;
  }

  getTimeSeries() {
    if (this.targets.some((target) => queryDef.hasMetricOfType(target, 'raw_data'))) {
      return this.processResponseToDataFrames(false);
    }
    const result = this.processResponseToSeries();
    return {
      ...result,
      data: result.data.map((item) => toDataFrame(item)),
    };
  }

  getLogs(logMessageField?: string, logLevelField?: string): DataQueryResponse {
    return this.processResponseToDataFrames(true, logMessageField, logLevelField);
  }

  private processResponseToDataFrames(
    isLogsRequest: boolean,
    logMessageField?: string,
    logLevelField?: string
  ): DataQueryResponse {
    const dataFrame: DataFrame[] = [];
    for (let n = 0; n < this.response.responses.length; n++) {
      const response = this.response.responses[n];
      if (response.error) {
        throw this.getErrorFromElasticResponse(this.response, response.error);
      }

      if (response.hits) {
        const { propNames, docs } = flattenHits(response.hits.hits);

        const series = docs.length
          ? createEmptyDataFrame(
              propNames.map(toNameTypePair(docs)),
              isLogsRequest,
              this.targets[0].timeField,
              logMessageField,
              logLevelField
            )
          : createEmptyDataFrame([], isLogsRequest);

        if (isLogsRequest) {
          addPreferredVisualisationType(series, 'logs');
        }

        // Add a row for each document
        for (const doc of docs) {
          if (logLevelField) {
            // Remap level field based on the datasource config. This field is
            // then used in explore to figure out the log level. We may rewrite
            // some actual data in the level field if they are different.
            doc['level'] = doc[logLevelField];
          }
          // When highlighting exists, we need to collect all the highlighted
          // phrases and add them to the DataFrame's meta.searchWords array.
          if (doc.highlight) {
            // There might be multiple words so we need two versions of the
            // regular expression. One to match gobally, when used with part.match,
            // it returns and array of matches. The second one is used to capture the
            // values between the tags.
            const globalHighlightWordRegex = new RegExp(HIGHLIGHT_TAGS_EXP, 'g');
            const highlightWordRegex = new RegExp(HIGHLIGHT_TAGS_EXP);
            const newSearchWords = Object.keys(doc.highlight)
              .flatMap((key) => {
                return doc.highlight[key].flatMap((line: string) => {
                  const matchedPhrases = line.match(globalHighlightWordRegex);
                  if (!matchedPhrases) {
                    return [];
                  }
                  return matchedPhrases.map((part) => {
                    const matches = part.match(highlightWordRegex);
                    return (matches && matches[1]) || null;
                  });
                });
              })
              .filter(identity);
            // If meta and searchWords already exists, add the words and
            // deduplicate otherwise create a new set of search words.
            const searchWords = series.meta?.searchWords
              ? uniq([...series.meta.searchWords, ...newSearchWords])
              : [...newSearchWords];
            series.meta = series.meta ? { ...series.meta, searchWords } : { searchWords };
          }
          series.add(doc);
        }

        const target = this.targets[n];
        series.refId = target.refId;
        dataFrame.push(series);
      }

      if (response.aggregations) {
        const aggregations = response.aggregations;
        const target = this.targets[n];
        const tmpSeriesList: any[] = [];
        const table = new TableModel();

        this.processBuckets(aggregations, target, tmpSeriesList, table, {}, 0);
        this.trimDatapoints(tmpSeriesList, target);
        this.nameSeries(tmpSeriesList, target);

        if (table.rows.length > 0) {
          const series = toDataFrame(table);
          series.refId = target.refId;
          dataFrame.push(series);
        }

        for (let y = 0; y < tmpSeriesList.length; y++) {
          let series = toDataFrame(tmpSeriesList[y]);

          // When log results, show aggregations only in graph. Log fields are then going to be shown in table.
          if (isLogsRequest) {
            addPreferredVisualisationType(series, 'graph');
          }

          series.refId = target.refId;
          dataFrame.push(series);
        }
      }
    }

    return { data: dataFrame };
  }

  processResponseToSeries = () => {
    const seriesList = [];

    for (let i = 0; i < this.response.responses.length; i++) {
      const response = this.response.responses[i];
      const target = this.targets[i];

      if (response.error) {
        throw this.getErrorFromElasticResponse(this.response, response.error);
      }

      if (response.hits && response.hits.hits.length > 0) {
        this.processHits(response.hits, seriesList, target);
      }

      if (response.aggregations) {
        const aggregations = response.aggregations;
        const target = this.targets[i];
        const tmpSeriesList: any[] = [];
        const table = new TableModel();
        table.refId = target.refId;

        this.processBuckets(aggregations, target, tmpSeriesList, table, {}, 0);
        this.trimDatapoints(tmpSeriesList, target);
        this.nameSeries(tmpSeriesList, target);

        for (let y = 0; y < tmpSeriesList.length; y++) {
          seriesList.push(tmpSeriesList[y]);
        }

        if (table.rows.length > 0) {
          seriesList.push(table);
        }
      }
    }

    return { data: seriesList };
  };
}

type Doc = {
  _id: string;
  _type: string;
  _index: string;
  _source?: any;
  sort?: Array<string | number>;
  highlight?: Record<string, string[]>;
};

/**
 * Flatten the docs from response mainly the _source part which can be nested. This flattens it so that it is one level
 * deep and the keys are: `level1Name.level2Name...`. Also returns list of all properties from all the docs (not all
 * docs have to have the same keys).
 * @param hits
 */
const flattenHits = (hits: Doc[]): { docs: Array<Record<string, any>>; propNames: string[] } => {
  const docs: any[] = [];
  // We keep a list of all props so that we can create all the fields in the dataFrame, this can lead
  // to wide sparse dataframes in case the scheme is different per document.
  let propNames: string[] = [];

  for (const hit of hits) {
    const flattened = hit._source ? flatten(hit._source) : {};
    const doc = {
      _id: hit._id,
      _type: hit._type,
      _index: hit._index,
      sort: hit.sort,
      highlight: hit.highlight,
      _source: { ...flattened },
      ...flattened,
    };

    for (const propName of Object.keys(doc)) {
      if (propNames.indexOf(propName) === -1) {
        propNames.push(propName);
      }
    }

    docs.push(doc);
  }

  propNames.sort();
  return { docs, propNames };
};

/**
 * Create empty dataframe but with created fields. Fields are based from propNames (should be from the response) and
 * also from configuration specified fields for message, time, and level.
 * @param propNames
 * @param timeField
 * @param logMessageField
 * @param logLevelField
 */
const createEmptyDataFrame = (
  props: Array<[string, FieldType]>,
  isLogsRequest: boolean,
  timeField?: string,
  logMessageField?: string,
  logLevelField?: string
): MutableDataFrame => {
  const series = new MutableDataFrame({ fields: [] });

  if (timeField) {
    series.addField({
      config: {
        filterable: true,
      },
      name: timeField,
      type: FieldType.time,
    });
  }

  if (logMessageField) {
    const f = series.addField({
      name: logMessageField,
      type: FieldType.string,
    });
    series.setParser(f, (v: any) => {
      return v || '';
    });
  }

  if (logLevelField) {
    const f = series.addField({
      name: 'level',
      type: FieldType.string,
    });
    series.setParser(f, (v: any) => {
      return v || '';
    });
  }

  const fieldNames = series.fields.map((field) => field.name);

  for (const [name, type] of props) {
    // Do not duplicate fields. This can mean that we will shadow some fields.
    if (fieldNames.includes(name)) {
      continue;
    }
    // Do not add _source field (besides logs) as we are showing each _source field in table instead.
    if (!isLogsRequest && name === '_source') {
      continue;
    }

    const f = series.addField({
      config: {
        filterable: true,
      },
      name,
      type,
    });
    series.setParser(f, (v: any) => {
      return v || '';
    });
  }

  return series;
};

const addPreferredVisualisationType = (series: any, type: PreferredVisualisationType) => {
  let s = series;
  s.meta
    ? (s.meta.preferredVisualisationType = type)
    : (s.meta = {
        preferredVisualisationType: type,
      });
};

const toNameTypePair =
  (docs: Array<Record<string, any>>) =>
  (propName: string): [string, FieldType] =>
    [propName, guessType(docs.find((doc) => doc[propName] !== undefined)?.[propName])];

/**
 * Trying to guess data type from its value. This is far from perfect, as in order to have accurate guess
 * we should have access to the elasticsearch mapping, but it covers the most common use cases for numbers, strings & arrays.
 */
const guessType = (value: unknown): FieldType => {
  switch (typeof value) {
    case 'number':
      return FieldType.number;
    case 'string':
      return FieldType.string;
    default:
      return FieldType.other;
  }
};
