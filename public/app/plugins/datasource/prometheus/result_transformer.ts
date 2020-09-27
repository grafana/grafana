import {
  ArrayVector,
  DataFrame,
  Field,
  FieldType,
  formatLabels,
  TIME_SERIES_TIME_FIELD_NAME,
  TIME_SERIES_VALUE_FIELD_NAME,
} from '@grafana/data';
import { FetchResponse } from '@grafana/runtime';
import templateSrv from 'app/features/templating/template_srv';
import {
  PromDataSuccessResponse,
  PromMatrixData,
  PromMetric,
  PromValue,
  PromVectorData,
  TransformOptions,
} from './types';

type MatrixOrVectorResult = PromMatrixData['result'][0] | PromVectorData['result'][0];

export function transform(response: FetchResponse<PromDataSuccessResponse>, options: TransformOptions) {
  const prometheusResult = response.data.data;

  if (!prometheusResult.result) {
    return [];
  }

  if (prometheusResult.resultType === 'scalar') {
    return [
      {
        meta: options.meta,
        refId: options.refId,
        length: 1,
        fields: [getTimeField([prometheusResult.result]), getValueField([prometheusResult.result])],
      },
    ];
  }

  if (options.format === 'table') {
    const tableData = transformMetricDataToTable(prometheusResult.result, options);
    return [tableData];
  }

  if (options.format === 'heatmap') {
    const dataFrame: DataFrame[] = [];

    prometheusResult.result.forEach((data: MatrixOrVectorResult) =>
      dataFrame.push(transformToDataFrame(data, options))
    );
    dataFrame.sort(sortSeriesByLabel);
    const seriesList = transformToHistogramOverTime(dataFrame);
    return seriesList;
  }

  const dataFrame: DataFrame[] = [];

  prometheusResult.result.forEach((data: MatrixOrVectorResult) => dataFrame.push(transformToDataFrame(data, options)));
  return dataFrame;
}

/**
 * Transforms matrix and vector result from Prometheus to DataFrame
 */
function transformToDataFrame(data: MatrixOrVectorResult, options: TransformOptions): DataFrame {
  const { name } = createLabelInfo(data.metric, options);

  const fields: Field[] = [];

  if ('values' in data) {
    const stepMs = options.step ? options.step * 1000 : NaN;
    let baseTimestamp = options.start * 1000;
    const dps: PromValue[] = [];

    for (const value of data.values) {
      let dpValue: number | null = parseFloat(value[1]);

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
    fields.push(getValueField(dps, undefined, false));
  } else {
    fields.push(getTimeField([data.value]));
    fields.push(getValueField([data.value]));
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

  const metricLabels: string[] = [];
  // Collect all labels across all metrics
  md.forEach(series => {
    for (const label in series.metric) {
      if (!metricLabels.some(metricLabel => metricLabel === label)) {
        metricLabels.push(label);
      }
    }
  });

  metricLabels.sort();

  // Get all values
  const allValues: PromValue[] = [];
  md.forEach(d => {
    if ('value' in d) {
      allValues.push(d.value);
    } else {
      allValues.push(...d.values);
    }
  });

  const valueText = options.responseListLength > 1 || options.valueWithRefId ? `Value #${options.refId}` : 'Value';

  const fields: Field[] = [
    getTimeField(allValues),
    ...metricLabels.map(label => {
      return {
        name: label,
        config: { filterable: true },
        type: FieldType.other,
        values: new ArrayVector(md.map(d => getLabelValue(d.metric, label))),
      };
    }),
    getValueField(allValues, valueText),
  ];

  return {
    meta: options.meta,
    refId: options.refId,
    length: fields[0].values.length,
    fields,
  };
}

function getLabelValue(metric: PromMetric, label: string): string | number {
  if (metric.hasOwnProperty(label)) {
    if (label === 'le') {
      return parseHistogramLabel(metric[label]);
    }
    return metric[label];
  }
  return '';
}

function getTimeField(data: PromValue[], isMs = false): Field {
  return {
    name: TIME_SERIES_TIME_FIELD_NAME,
    type: FieldType.time,
    config: {},
    values: new ArrayVector<number>(data.map(val => (isMs ? val[0] : val[0] * 1000))),
  };
}

function getValueField(data: PromValue[], valueName: string = TIME_SERIES_VALUE_FIELD_NAME, parseValue = true): Field {
  return {
    name: valueName,
    type: FieldType.number,
    config: {},
    values: new ArrayVector<number | null>(data.map(val => (parseValue ? parseFloat(val[1]) : val[1]))),
  };
}

function createLabelInfo(labels: { [key: string]: string }, options: TransformOptions) {
  if (options?.legendFormat) {
    const title = renderTemplate(templateSrv.replace(options.legendFormat, options?.scopedVars), labels);
    return { name: title, labels };
  }

  let { __name__, ...labelsWithoutName } = labels;

  let title = __name__ || '';

  const labelPart = formatLabels(labelsWithoutName);

  if (!title && !labelPart) {
    title = options.query;
  }

  title = `${__name__ ?? ''}${labelPart}`;

  return { name: title, labels: labelsWithoutName };
}

export function getOriginalMetricName(labelData: { [key: string]: string }) {
  const metricName = labelData.__name__ || '';
  delete labelData.__name__;
  const labelPart = Object.entries(labelData)
    .map(label => `${label[0]}="${label[1]}"`)
    .join(',');
  return `${metricName}{${labelPart}}`;
}

export function renderTemplate(aliasPattern: string, aliasData: { [key: string]: string }) {
  const aliasRegex = /\{\{\s*(.+?)\s*\}\}/g;
  return aliasPattern.replace(aliasRegex, (_match, g1) => {
    if (aliasData[g1]) {
      return aliasData[g1];
    }
    return '';
  });
}

function transformToHistogramOverTime(seriesList: DataFrame[]) {
  /*      t1 = timestamp1, t2 = timestamp2 etc.
            t1  t2  t3          t1  t2  t3
    le10    10  10  0     =>    10  10  0
    le20    20  10  30    =>    10  0   30
    le30    30  10  35    =>    10  0   5
    */
  for (let i = seriesList.length - 1; i > 0; i--) {
    const topSeries = seriesList[i].fields.find(s => s.name === TIME_SERIES_VALUE_FIELD_NAME);
    const bottomSeries = seriesList[i - 1].fields.find(s => s.name === TIME_SERIES_VALUE_FIELD_NAME);
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

function sortSeriesByLabel(s1: DataFrame, s2: DataFrame): number {
  let le1, le2;

  try {
    // fail if not integer. might happen with bad queries
    le1 = parseHistogramLabel(s1.name ?? '');
    le2 = parseHistogramLabel(s2.name ?? '');
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

function parseHistogramLabel(le: string): number {
  if (le === '+Inf') {
    return +Infinity;
  }
  return Number(le);
}
