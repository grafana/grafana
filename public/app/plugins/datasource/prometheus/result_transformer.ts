import { descending, deviation } from 'd3';
import { flatten, forOwn, groupBy, partition } from 'lodash';

import {
  ArrayDataFrame,
  ArrayVector,
  CoreApp,
  DataFrame,
  DataFrameType,
  DataLink,
  DataQueryRequest,
  DataQueryResponse,
  DataTopic,
  Field,
  FieldType,
  formatLabels,
  getDisplayProcessor,
  Labels,
  MutableField,
  PreferredVisualisationType,
  ScopedVars,
  TIME_SERIES_TIME_FIELD_NAME,
  TIME_SERIES_VALUE_FIELD_NAME,
} from '@grafana/data';
import { FetchResponse, getDataSourceSrv, getTemplateSrv } from '@grafana/runtime';

import { renderLegendFormat } from './legend';
import {
  ExemplarTraceIdDestination,
  isExemplarData,
  isMatrixData,
  MatrixOrVectorResult,
  PromDataSuccessResponse,
  PromMetric,
  PromQuery,
  PromQueryRequest,
  PromValue,
  TransformOptions,
} from './types';

// handles case-insensitive Inf, +Inf, -Inf (with optional "inity" suffix)
const INFINITY_SAMPLE_REGEX = /^[+-]?inf(?:inity)?$/i;

interface TimeAndValue {
  [TIME_SERIES_TIME_FIELD_NAME]: number;
  [TIME_SERIES_VALUE_FIELD_NAME]: number;
}

const isTableResult = (dataFrame: DataFrame, options: DataQueryRequest<PromQuery>): boolean => {
  // We want to process vector and scalar results in Explore as table
  if (
    options.app === CoreApp.Explore &&
    (dataFrame.meta?.custom?.resultType === 'vector' || dataFrame.meta?.custom?.resultType === 'scalar')
  ) {
    return true;
  }

  // We want to process all dataFrames with target.format === 'table' as table
  const target = options.targets.find((target) => target.refId === dataFrame.refId);
  return target?.format === 'table';
};

const isHeatmapResult = (dataFrame: DataFrame, options: DataQueryRequest<PromQuery>): boolean => {
  const target = options.targets.find((target) => target.refId === dataFrame.refId);
  return target?.format === 'heatmap';
};

// V2 result transformer used to transform query results from queries that were run through prometheus backend
export function transformV2(
  response: DataQueryResponse,
  request: DataQueryRequest<PromQuery>,
  options: { exemplarTraceIdDestinations?: ExemplarTraceIdDestination[] }
) {
  const [tableFrames, framesWithoutTable] = partition<DataFrame>(response.data, (df) => isTableResult(df, request));
  const processedTableFrames = transformDFToTable(tableFrames);

  const [exemplarFrames, framesWithoutTableAndExemplars] = partition<DataFrame>(
    framesWithoutTable,
    (df) => df.meta?.custom?.resultType === 'exemplar'
  );

  // EXEMPLAR FRAMES: We enrich exemplar frames with data links and add dataTopic meta info
  const { exemplarTraceIdDestinations: destinations } = options;
  const processedExemplarFrames = exemplarFrames.map((dataFrame) => {
    if (destinations?.length) {
      for (const exemplarTraceIdDestination of destinations) {
        const traceIDField = dataFrame.fields.find((field) => field.name === exemplarTraceIdDestination.name);
        if (traceIDField) {
          const links = getDataLinks(exemplarTraceIdDestination);
          traceIDField.config.links = traceIDField.config.links?.length
            ? [...traceIDField.config.links, ...links]
            : links;
        }
      }
    }

    return { ...dataFrame, meta: { ...dataFrame.meta, dataTopic: DataTopic.Annotations } };
  });

  const [heatmapResults, framesWithoutTableHeatmapsAndExemplars] = partition<DataFrame>(
    framesWithoutTableAndExemplars,
    (df) => isHeatmapResult(df, request)
  );

  // this works around the fact that we only get back frame.name with le buckets when legendFormat == {{le}}...which is not the default
  heatmapResults.forEach((df) => {
    if (df.name == null) {
      let f = df.fields.find((f) => f.name === 'Value');

      if (f) {
        let le = f.labels?.le;

        if (le) {
          // this is used for sorting the frames by numeric ascending le labels for de-accum
          df.name = le;
          // this is used for renaming the Value fields to le label
          f.config.displayNameFromDS = le;
        }
      }
    }
  });

  // Group heatmaps by query
  const heatmapResultsGroupedByQuery = groupBy<DataFrame>(heatmapResults, (h) => h.refId);

  // Initialize empty array to push grouped histogram frames to
  let processedHeatmapResultsGroupedByQuery: DataFrame[][] = [];

  // Iterate through every query in this heatmap
  for (const query in heatmapResultsGroupedByQuery) {
    // Get reference to dataFrames for heatmap
    const heatmapResultsGroup = heatmapResultsGroupedByQuery[query];

    // Create a new grouping by iterating through the data frames...
    const heatmapResultsGroupedByValues = groupBy<DataFrame>(heatmapResultsGroup, (dataFrame) => {
      // Each data frame has `Time` and `Value` properties, we want to get the values
      const values = dataFrame.fields.find((field) => field.name === TIME_SERIES_VALUE_FIELD_NAME);
      // Specific functionality for special "le" quantile heatmap value, we know if this value exists, that we do not want to calculate the heatmap density across data frames from the same quartile
      if (values?.labels && HISTOGRAM_QUANTILE_LABEL_NAME in values.labels) {
        const { le, ...notLE } = values?.labels;
        return Object.values(notLE).join();
      }

      // Return a string made from the concatenation of this frame's values to represent a grouping in the query
      return Object.values(values?.labels ?? []).join();
    });

    // Then iterate through the resultant object
    forOwn(heatmapResultsGroupedByValues, (dataFrames, key) => {
      // Sort frames within each grouping
      const sortedHeatmap = dataFrames.sort(sortSeriesByLabel);
      // And push the sorted grouping with the rest
      processedHeatmapResultsGroupedByQuery.push(mergeHeatmapFrames(transformToHistogramOverTime(sortedHeatmap)));
    });
  }

  // Everything else is processed as time_series result and graph preferredVisualisationType
  const otherFrames = framesWithoutTableHeatmapsAndExemplars.map((dataFrame) => {
    const df: DataFrame = {
      ...dataFrame,
      meta: {
        ...dataFrame.meta,
        preferredVisualisationType: 'graph',
      },
    };
    return df;
  });

  const flattenedProcessedHeatmapFrames = flatten(processedHeatmapResultsGroupedByQuery);

  return {
    ...response,
    data: [...otherFrames, ...processedTableFrames, ...flattenedProcessedHeatmapFrames, ...processedExemplarFrames],
  };
}

const HISTOGRAM_QUANTILE_LABEL_NAME = 'le';

export function transformDFToTable(dfs: DataFrame[]): DataFrame[] {
  // If no dataFrames or if 1 dataFrames with no values, return original dataFrame
  if (dfs.length === 0 || (dfs.length === 1 && dfs[0].length === 0)) {
    return dfs;
  }

  // Group results by refId and process dataFrames with the same refId as 1 dataFrame
  const dataFramesByRefId = groupBy(dfs, 'refId');
  const refIds = Object.keys(dataFramesByRefId);

  const frames = refIds.map((refId) => {
    // Create timeField, valueField and labelFields
    const valueText = getValueText(refIds.length, refId);
    const valueField = getValueField({ data: [], valueName: valueText });
    const timeField = getTimeField([]);
    const labelFields: MutableField[] = [];

    // Fill labelsFields with labels from dataFrames
    dataFramesByRefId[refId].forEach((df) => {
      const frameValueField = df.fields[1];
      const promLabels = frameValueField?.labels ?? {};

      Object.keys(promLabels)
        .sort()
        .forEach((label) => {
          // If we don't have label in labelFields, add it
          if (!labelFields.some((l) => l.name === label)) {
            const numberField = label === HISTOGRAM_QUANTILE_LABEL_NAME;
            labelFields.push({
              name: label,
              config: { filterable: true },
              type: numberField ? FieldType.number : FieldType.string,
              values: new ArrayVector(),
            });
          }
        });
    });

    // Fill valueField, timeField and labelFields with values
    dataFramesByRefId[refId].forEach((df) => {
      const timeFields = df.fields[0]?.values ?? new ArrayVector();
      const dataFields = df.fields[1]?.values ?? new ArrayVector();
      timeFields.toArray().forEach((value) => timeField.values.add(value));
      dataFields.toArray().forEach((value) => {
        valueField.values.add(parseSampleValue(value));
        const labelsForField = df.fields[1].labels ?? {};
        labelFields.forEach((field) => field.values.add(getLabelValue(labelsForField, field.name)));
      });
    });

    const fields = [timeField, ...labelFields, valueField];
    return {
      refId,
      fields,
      // Prometheus specific UI for instant queries
      meta: { ...dfs[0].meta, preferredVisualisationType: 'rawPrometheus' as PreferredVisualisationType },
      length: timeField.values.length,
    };
  });
  return frames;
}

function getValueText(responseLength: number, refId = '') {
  return responseLength > 1 ? `Value #${refId}` : 'Value';
}

export function transform(
  response: FetchResponse<PromDataSuccessResponse>,
  transformOptions: {
    query: PromQueryRequest;
    exemplarTraceIdDestinations?: ExemplarTraceIdDestination[];
    target: PromQuery;
    responseListLength: number;
    scopedVars?: ScopedVars;
  }
) {
  // Create options object from transformOptions
  const options: TransformOptions = {
    format: transformOptions.target.format,
    step: transformOptions.query.step,
    legendFormat: transformOptions.target.legendFormat,
    start: transformOptions.query.start,
    end: transformOptions.query.end,
    query: transformOptions.query.expr,
    responseListLength: transformOptions.responseListLength,
    scopedVars: transformOptions.scopedVars,
    refId: transformOptions.target.refId,
    valueWithRefId: transformOptions.target.valueWithRefId,
    meta: {
      // Fix for showing of Prometheus results in Explore table
      preferredVisualisationType: transformOptions.query.instant ? 'rawPrometheus' : 'graph',
    },
  };
  const prometheusResult = response.data.data;

  if (isExemplarData(prometheusResult)) {
    const events: TimeAndValue[] = [];
    prometheusResult.forEach((exemplarData) => {
      const data = exemplarData.exemplars.map((exemplar) => {
        return {
          [TIME_SERIES_TIME_FIELD_NAME]: exemplar.timestamp * 1000,
          [TIME_SERIES_VALUE_FIELD_NAME]: exemplar.value,
          ...exemplar.labels,
          ...exemplarData.seriesLabels,
        };
      });
      events.push(...data);
    });

    // Grouping exemplars by step
    const sampledExemplars = sampleExemplars(events, options);

    const dataFrame = new ArrayDataFrame(sampledExemplars);
    dataFrame.meta = { dataTopic: DataTopic.Annotations };

    // Add data links if configured
    if (transformOptions.exemplarTraceIdDestinations?.length) {
      for (const exemplarTraceIdDestination of transformOptions.exemplarTraceIdDestinations) {
        const traceIDField = dataFrame.fields.find((field) => field.name === exemplarTraceIdDestination.name);
        if (traceIDField) {
          const links = getDataLinks(exemplarTraceIdDestination);
          traceIDField.config.links = traceIDField.config.links?.length
            ? [...traceIDField.config.links, ...links]
            : links;
        }
      }
    }
    return [dataFrame];
  }

  if (!prometheusResult?.result) {
    return [];
  }

  // Return early if result type is scalar
  if (prometheusResult.resultType === 'scalar') {
    return [
      {
        meta: options.meta,
        refId: options.refId,
        length: 1,
        fields: [getTimeField([prometheusResult.result]), getValueField({ data: [prometheusResult.result] })],
      },
    ];
  }

  // Return early again if the format is table, this needs special transformation.
  if (options.format === 'table') {
    const tableData = transformMetricDataToTable(prometheusResult.result, options);
    return [tableData];
  }

  // Process matrix and vector results to DataFrame
  const dataFrame: DataFrame[] = [];
  prometheusResult.result.forEach((data: MatrixOrVectorResult) => dataFrame.push(transformToDataFrame(data, options)));

  // When format is heatmap use the already created data frames and transform it more
  if (options.format === 'heatmap') {
    return mergeHeatmapFrames(transformToHistogramOverTime(dataFrame.sort(sortSeriesByLabel)));
  }

  // Return matrix or vector result as DataFrame[]
  return dataFrame;
}

function getDataLinks(options: ExemplarTraceIdDestination): DataLink[] {
  const dataLinks: DataLink[] = [];

  if (options.datasourceUid) {
    const dataSourceSrv = getDataSourceSrv();
    const dsSettings = dataSourceSrv.getInstanceSettings(options.datasourceUid);

    // dsSettings is undefined because of the reasons below:
    // - permissions issues (probably most likely)
    // - deleted datasource
    // - misconfiguration
    if (dsSettings) {
      dataLinks.push({
        title: options.urlDisplayLabel || `Query with ${dsSettings?.name}`,
        url: '',
        internal: {
          query: { query: '${__value.raw}', queryType: 'traceql' },
          datasourceUid: options.datasourceUid,
          datasourceName: dsSettings?.name ?? 'Data source not found',
        },
      });
    }
  }

  if (options.url) {
    dataLinks.push({
      title: options.urlDisplayLabel || `Go to ${options.url}`,
      url: options.url,
      targetBlank: true,
    });
  }
  return dataLinks;
}

/**
 * Reduce the density of the exemplars by making sure that the highest value exemplar is included
 * and then only the ones that are 2 times the standard deviation of the all the values.
 * This makes sure not to show too many dots near each other.
 */
function sampleExemplars(events: TimeAndValue[], options: TransformOptions) {
  const step = options.step || 15;
  const bucketedExemplars: { [ts: string]: TimeAndValue[] } = {};
  const values: number[] = [];
  for (const exemplar of events) {
    // Align exemplar timestamp to nearest step second
    const alignedTs = String(Math.floor(exemplar[TIME_SERIES_TIME_FIELD_NAME] / 1000 / step) * step * 1000);
    if (!bucketedExemplars[alignedTs]) {
      // New bucket found
      bucketedExemplars[alignedTs] = [];
    }
    bucketedExemplars[alignedTs].push(exemplar);
    values.push(exemplar[TIME_SERIES_VALUE_FIELD_NAME]);
  }

  // Getting exemplars from each bucket
  const standardDeviation = deviation(values);
  const sampledBuckets = Object.keys(bucketedExemplars).sort();
  const sampledExemplars = [];
  for (const ts of sampledBuckets) {
    const exemplarsInBucket = bucketedExemplars[ts];
    if (exemplarsInBucket.length === 1) {
      sampledExemplars.push(exemplarsInBucket[0]);
    } else {
      // Choose which values to sample
      const bucketValues = exemplarsInBucket.map((ex) => ex[TIME_SERIES_VALUE_FIELD_NAME]).sort(descending);
      const sampledBucketValues = bucketValues.reduce((acc: number[], curr) => {
        if (acc.length === 0) {
          // First value is max and is always added
          acc.push(curr);
        } else {
          // Then take values only when at least 2 standard deviation distance to previously taken value
          const prev = acc[acc.length - 1];
          if (standardDeviation && prev - curr >= 2 * standardDeviation) {
            acc.push(curr);
          }
        }
        return acc;
      }, []);
      // Find the exemplars for the sampled values
      sampledExemplars.push(
        ...sampledBucketValues.map(
          (value) => exemplarsInBucket.find((ex) => ex[TIME_SERIES_VALUE_FIELD_NAME] === value)!
        )
      );
    }
  }
  return sampledExemplars;
}

/**
 * Transforms matrix and vector result from Prometheus result to DataFrame
 */
function transformToDataFrame(data: MatrixOrVectorResult, options: TransformOptions): DataFrame {
  const { name, labels } = createLabelInfo(data.metric, options);

  const fields: Field[] = [];

  if (isMatrixData(data)) {
    const stepMs = options.step ? options.step * 1000 : NaN;
    let baseTimestamp = options.start * 1000;
    const dps: PromValue[] = [];

    for (const value of data.values) {
      let dpValue: number | null = parseSampleValue(value[1]);

      if (isNaN(dpValue)) {
        dpValue = null;
      }

      const timestamp = value[0] * 1000;
      for (let t = baseTimestamp; t < timestamp; t += stepMs) {
        dps.push([t, null]);
      }
      baseTimestamp = timestamp + stepMs;
      dps.push([timestamp, dpValue]);
    }

    const endTimestamp = options.end * 1000;
    for (let t = baseTimestamp; t <= endTimestamp; t += stepMs) {
      dps.push([t, null]);
    }
    fields.push(getTimeField(dps, true));
    fields.push(getValueField({ data: dps, parseValue: false, labels, displayNameFromDS: name }));
  } else {
    fields.push(getTimeField([data.value]));
    fields.push(getValueField({ data: [data.value], labels, displayNameFromDS: name }));
  }

  return {
    meta: options.meta,
    refId: options.refId,
    length: fields[0].values.length,
    fields,
    name,
  };
}

function transformMetricDataToTable(md: MatrixOrVectorResult[], options: TransformOptions): DataFrame {
  if (!md || md.length === 0) {
    return {
      meta: options.meta,
      refId: options.refId,
      length: 0,
      fields: [],
    };
  }

  const valueText = options.responseListLength > 1 || options.valueWithRefId ? `Value #${options.refId}` : 'Value';

  const timeField = getTimeField([]);
  const metricFields = Object.keys(md.reduce((acc, series) => ({ ...acc, ...series.metric }), {}))
    .sort()
    .map((label) => {
      // Labels have string field type, otherwise table tries to figure out the type which can result in unexpected results
      // Only "le" label has a number field type
      const numberField = label === HISTOGRAM_QUANTILE_LABEL_NAME;
      return {
        name: label,
        config: { filterable: true },
        type: numberField ? FieldType.number : FieldType.string,
        values: new ArrayVector(),
      };
    });
  const valueField = getValueField({ data: [], valueName: valueText });

  md.forEach((d) => {
    if (isMatrixData(d)) {
      d.values.forEach((val) => {
        timeField.values.add(val[0] * 1000);
        metricFields.forEach((metricField) => metricField.values.add(getLabelValue(d.metric, metricField.name)));
        valueField.values.add(parseSampleValue(val[1]));
      });
    } else {
      timeField.values.add(d.value[0] * 1000);
      metricFields.forEach((metricField) => metricField.values.add(getLabelValue(d.metric, metricField.name)));
      valueField.values.add(parseSampleValue(d.value[1]));
    }
  });

  return {
    meta: options.meta,
    refId: options.refId,
    length: timeField.values.length,
    fields: [timeField, ...metricFields, valueField],
  };
}

function getLabelValue(metric: PromMetric, label: string): string | number {
  if (metric.hasOwnProperty(label)) {
    if (label === HISTOGRAM_QUANTILE_LABEL_NAME) {
      return parseSampleValue(metric[label]);
    }
    return metric[label];
  }
  return '';
}

function getTimeField(data: PromValue[], isMs = false): MutableField {
  return {
    name: TIME_SERIES_TIME_FIELD_NAME,
    type: FieldType.time,
    config: {},
    values: new ArrayVector<number>(data.map((val) => (isMs ? val[0] : val[0] * 1000))),
  };
}

type ValueFieldOptions = {
  data: PromValue[];
  valueName?: string;
  parseValue?: boolean;
  labels?: Labels;
  displayNameFromDS?: string;
};

function getValueField({
  data,
  valueName = TIME_SERIES_VALUE_FIELD_NAME,
  parseValue = true,
  labels,
  displayNameFromDS,
}: ValueFieldOptions): MutableField {
  return {
    name: valueName,
    type: FieldType.number,
    display: getDisplayProcessor(),
    config: {
      displayNameFromDS,
    },
    labels,
    values: new ArrayVector<number | null>(data.map((val) => (parseValue ? parseSampleValue(val[1]) : val[1]))),
  };
}

function createLabelInfo(labels: { [key: string]: string }, options: TransformOptions) {
  if (options?.legendFormat) {
    const title = renderLegendFormat(getTemplateSrv().replace(options.legendFormat, options?.scopedVars), labels);
    return { name: title, labels };
  }

  const { __name__, ...labelsWithoutName } = labels;
  const labelPart = formatLabels(labelsWithoutName);
  let title = `${__name__ ?? ''}${labelPart}`;

  if (!title) {
    title = options.query;
  }

  return { name: title, labels: labelsWithoutName };
}

export function getOriginalMetricName(labelData: { [key: string]: string }) {
  const metricName = labelData.__name__ || '';
  delete labelData.__name__;
  const labelPart = Object.entries(labelData)
    .map((label) => `${label[0]}="${label[1]}"`)
    .join(',');
  return `${metricName}{${labelPart}}`;
}

function mergeHeatmapFrames(frames: DataFrame[]): DataFrame[] {
  if (frames.length === 0) {
    return [];
  }

  const timeField = frames[0].fields.find((field) => field.type === FieldType.time)!;
  const countFields = frames.map((frame) => {
    let field = frame.fields.find((field) => field.type === FieldType.number)!;

    return {
      ...field,
      name: field.config.displayNameFromDS!,
    };
  });

  return [
    {
      ...frames[0],
      meta: {
        ...frames[0].meta,
        type: DataFrameType.HeatmapRows,
      },
      fields: [timeField!, ...countFields],
    },
  ];
}

function transformToHistogramOverTime(seriesList: DataFrame[]) {
  /*      t1 = timestamp1, t2 = timestamp2 etc.
            t1  t2  t3          t1  t2  t3
    le10    10  10  0     =>    10  10  0
    le20    20  10  30    =>    10  0   30
    le30    30  10  35    =>    10  0   5
    */
  for (let i = seriesList.length - 1; i > 0; i--) {
    const topSeries = seriesList[i].fields.find((s) => s.name === TIME_SERIES_VALUE_FIELD_NAME);
    const bottomSeries = seriesList[i - 1].fields.find((s) => s.name === TIME_SERIES_VALUE_FIELD_NAME);
    if (!topSeries || !bottomSeries) {
      throw new Error('Prometheus heatmap transform error: data should be a time series');
    }

    for (let j = 0; j < topSeries.values.length; j++) {
      const bottomPoint = bottomSeries.values.get(j) || [0];
      topSeries.values.toArray()[j] -= bottomPoint;
    }
  }

  return seriesList;
}

export function sortSeriesByLabel(s1: DataFrame, s2: DataFrame): number {
  let le1, le2;

  try {
    // fail if not integer. might happen with bad queries
    le1 = parseSampleValue(s1.name ?? s1.fields[1].name);
    le2 = parseSampleValue(s2.name ?? s2.fields[1].name);
  } catch (err) {
    console.error(err);
    return 0;
  }

  if (le1 > le2) {
    return 1;
  }

  if (le1 < le2) {
    return -1;
  }

  return 0;
}

/** @internal */
export function parseSampleValue(value: string): number {
  if (INFINITY_SAMPLE_REGEX.test(value)) {
    return value[0] === '-' ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY;
  }
  return parseFloat(value);
}
