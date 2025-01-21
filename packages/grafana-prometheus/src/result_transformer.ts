// Core Grafana history https://github.com/grafana/grafana/blob/v11.0.0-preview/public/app/plugins/datasource/prometheus/result_transformer.ts
import { flatten, forOwn, groupBy, partition } from 'lodash';

import {
  CoreApp,
  DataFrame,
  DataFrameType,
  DataLink,
  DataQueryRequest,
  DataQueryResponse,
  DataTopic,
  Field,
  FieldType,
  getDisplayProcessor,
  getFieldDisplayName,
  Labels,
  sortDataFrame,
  TIME_SERIES_TIME_FIELD_NAME,
  TIME_SERIES_VALUE_FIELD_NAME,
} from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';

import { ExemplarTraceIdDestination, PromMetric, PromQuery, PromValue } from './types';

// handles case-insensitive Inf, +Inf, -Inf (with optional "inity" suffix)
const INFINITY_SAMPLE_REGEX = /^[+-]?inf(?:inity)?$/i;

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

const isCumulativeHeatmapResult = (dataFrame: DataFrame, options: DataQueryRequest<PromQuery>): boolean => {
  if (dataFrame.meta?.type === DataFrameType.HeatmapCells) {
    return false;
  }

  const target = options.targets.find((target) => target.refId === dataFrame.refId);
  return target?.format === 'heatmap';
};

// V2 result transformer used to transform query results from queries that were run through prometheus backend
export function transformV2(
  response: DataQueryResponse,
  request: DataQueryRequest<PromQuery>,
  options: { exemplarTraceIdDestinations?: ExemplarTraceIdDestination[] }
) {
  // migration for dataplane field name issue
  // update displayNameFromDS in the field config
  response.data.forEach((f: DataFrame) => {
    const target = request.targets.find((t) => t.refId === f.refId);
    // check that the legend is selected as auto
    if (target && target.legendFormat === '__auto') {
      f.fields.forEach((field) => {
        if (field.labels?.__name__ && field.labels?.__name__ === field.name) {
          const fieldCopy = { ...field, name: TIME_SERIES_VALUE_FIELD_NAME };
          field.config.displayNameFromDS = getFieldDisplayName(fieldCopy, f, response.data);
        }
      });
    }
  });

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
    (df) => isCumulativeHeatmapResult(df, request)
  );

  // this works around the fact that we only get back frame.name with le buckets when legendFormat == {{le}}...which is not the default
  heatmapResults.forEach((df) => {
    if (df.name == null) {
      let f = df.fields.find((f) => f.type === FieldType.number);

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
      const values = dataFrame.fields.find((field) => field.type === FieldType.number);
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
    const labelFields: Field[] = [];

    // Fill labelsFields with labels from dataFrames
    dataFramesByRefId[refId].forEach((df) => {
      const frameValueField = df.fields[1];
      const promLabels = frameValueField?.labels ?? {};

      Object.keys(promLabels)
        .sort()
        .forEach((label) => {
          // If we don't have label in labelFields, add it
          if (!labelFields.some((l) => l.name === label)) {
            labelFields.push({
              name: label,
              config: { filterable: true },
              type: FieldType.string,
              values: [],
            });
          }
        });
    });

    let prevTime = -Infinity;
    let needsSort = false;

    // Fill valueField, timeField and labelFields with values
    dataFramesByRefId[refId].forEach((df) => {
      timeField.config.interval ??= df.fields[0]?.config.interval;

      const timeFields = df.fields[0]?.values ?? [];
      const dataFields = df.fields[1]?.values ?? [];

      timeFields.forEach((value) => {
        timeField.values.push(value);

        if (value < prevTime) {
          needsSort = true;
        }

        prevTime = value;
      });

      dataFields.forEach((value) => {
        valueField.values.push(parseSampleValue(value));
        const labelsForField = df.fields[1].labels ?? {};
        labelFields.forEach((field) => field.values.push(getLabelValue(labelsForField, field.name)));
      });
    });

    const fields = [timeField, ...labelFields, valueField];

    const frame: DataFrame = {
      refId,
      fields,
      // Prometheus specific UI for instant queries
      meta: {
        ...dataFramesByRefId[refId][0].meta,
        preferredVisualisationType: 'rawPrometheus' as const,
      },
      length: timeField.values.length,
    };

    return needsSort ? sortDataFrame(frame, 0) : frame;
  });

  return frames;
}

function getValueText(responseLength: number, refId = '') {
  return responseLength > 1 ? `Value #${refId}` : 'Value';
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

function getLabelValue(metric: PromMetric, label: string): string | number {
  if (metric.hasOwnProperty(label)) {
    return metric[label];
  }
  return '';
}

function getTimeField(data: PromValue[], isMs = false): Field<number> {
  return {
    name: TIME_SERIES_TIME_FIELD_NAME,
    type: FieldType.time,
    config: {},
    values: data.map((val) => (isMs ? val[0] : val[0] * 1000)),
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
}: ValueFieldOptions): Field {
  return {
    name: valueName,
    type: FieldType.number,
    display: getDisplayProcessor(),
    config: {
      displayNameFromDS,
    },
    labels,
    values: data.map((val) => (parseValue ? parseSampleValue(val[1]) : val[1])),
  };
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
  if (frames.length === 0 || (frames.length === 1 && frames[0].length === 0)) {
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

/** @internal */
export function transformToHistogramOverTime(seriesList: DataFrame[]): DataFrame[] {
  /*      t1 = timestamp1, t2 = timestamp2 etc.
            t1  t2  t3          t1  t2  t3
    le10    10  10  0     =>    10  10  0
    le20    20  10  30    =>    10  0   30
    le30    30  10  35    =>    10  0   5
    */

  for (let i = seriesList.length - 1; i > 0; i--) {
    const topSeries = seriesList[i].fields.find((s) => s.type === FieldType.number);
    const bottomSeries = seriesList[i - 1].fields.find((s) => s.type === FieldType.number);
    if (!topSeries || !bottomSeries) {
      throw new Error('Prometheus heatmap transform error: data should be a time series');
    }

    for (let j = 0; j < topSeries.values.length; j++) {
      const bottomPoint = bottomSeries.values[j] || [0];
      topSeries.values[j] -= bottomPoint;

      if (topSeries.values[j] < 1e-9) {
        topSeries.values[j] = 0;
      }
    }
  }

  return seriesList;
}

export function sortSeriesByLabel(s1: DataFrame, s2: DataFrame): number {
  let le1, le2;

  try {
    // the state.displayName conditions are here because we also use this sorting util fn
    // in panels where isHeatmapResult was false but we still want to sort numerically-named
    // fields after the full unique displayName is cached in field state
    le1 = parseSampleValue(s1.fields[1].state?.displayName ?? s1.name ?? s1.fields[1].name);
    le2 = parseSampleValue(s2.fields[1].state?.displayName ?? s2.name ?? s2.fields[1].name);
  } catch (err) {
    // fail if not integer. might happen with bad queries
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
