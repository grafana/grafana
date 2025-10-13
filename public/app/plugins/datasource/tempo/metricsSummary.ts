import {
  createDataFrame,
  DataSourceInstanceSettings,
  FieldDTO,
  FieldType,
  MutableDataFrame,
  sortDataFrame,
} from '@grafana/data';

export type MetricsSummary = {
  spanCount: string;
  errorSpanCount?: string;
  p50: string;
  p90: string;
  p95: string;
  p99: string;
  series: Series[];
};

type Series = {
  key: string;
  value: {
    type: number;
    n?: number;
    f?: number;
    s?: string;
    b?: string;
    d?: string;
    status?: number;
    kind?: number;
  };
};

type MetricsData = {
  spanCount: number;
  errorPercentage: number | string;
  p50: number;
  p90: number;
  p95: number;
  p99: number;
  [key: string]: string | number;
};

export function createTableFrameFromMetricsSummaryQuery(
  data: MetricsSummary[],
  targetQuery: string,
  instanceSettings: DataSourceInstanceSettings
) {
  let frame;

  if (!data.length) {
    return emptyResponse;
  }

  const dynamicMetrics: Record<string, FieldDTO> = {};
  data.forEach((res: MetricsSummary) => {
    const configQuery = getConfigQuery(res.series, targetQuery);
    res.series.forEach((series: Series) => {
      dynamicMetrics[series.key] = {
        name: `${series.key}`,
        type: FieldType.string,
        config: getConfig(series, configQuery, instanceSettings),
        values: [],
      };
    });
  });

  frame = createDataFrame({
    name: 'Metrics Summary',
    refId: 'metrics-summary',
    fields: [
      ...Object.values(dynamicMetrics).sort((a, b) => a.name.localeCompare(b.name)),
      {
        name: 'spanCount',
        type: FieldType.number,
        config: { displayNameFromDS: 'Span count', custom: { width: 150 } },
      },
      {
        name: 'errorPercentage',
        type: FieldType.number,
        config: { displayNameFromDS: 'Error', unit: 'percent', custom: { width: 150 } },
      },
      getPercentileRow('p50'),
      getPercentileRow('p90'),
      getPercentileRow('p95'),
      getPercentileRow('p99'),
    ],
    meta: {
      preferredVisualisationType: 'table',
    },
  });

  const metricsData = data.map(transformToMetricsData);
  frame.length = metricsData.length;
  for (const trace of metricsData) {
    for (const field of frame.fields) {
      field.values.push(trace[field.name]);
    }
  }
  frame = sortDataFrame(frame, 0);

  return [frame];
}

export const transformToMetricsData = (data: MetricsSummary) => {
  const errorPercentage = data.errorSpanCount
    ? (getNumberForMetric(data.errorSpanCount) / getNumberForMetric(data.spanCount)) * 100
    : '0%';

  const metricsData: MetricsData = {
    spanCount: getNumberForMetric(data.spanCount),
    errorPercentage,
    p50: getNumberForMetric(data.p50),
    p90: getNumberForMetric(data.p90),
    p95: getNumberForMetric(data.p95),
    p99: getNumberForMetric(data.p99),
  };

  data.series.forEach((series: Series) => {
    metricsData[`${series.key}`] = getMetricValue(series) || '';
  });

  return metricsData;
};

export const getConfigQuery = (series: Series[], targetQuery: string) => {
  const queryParts = series.map((x: Series) => {
    const isNumber = x.value.type === 3 || x.value.type === 4;
    const isIntrinsic = x.value.type === 8 || x.value.type === 9;
    const surround = isNumber || isIntrinsic ? '' : '"';
    return `${x.key}=${surround}` + '${__data.fields["' + x.key + '"]}' + `${surround}`;
  });

  let configQuery = '';
  const closingBracketIndex = targetQuery.indexOf('}');

  if (closingBracketIndex !== -1) {
    const queryAfterClosingBracket = targetQuery.substring(closingBracketIndex + 1);
    configQuery = targetQuery.substring(0, closingBracketIndex);
    if (queryParts.length > 0) {
      configQuery += targetQuery.replace(/\s/g, '').includes('{}') ? '' : ' && ';
      configQuery += `${queryParts.join(' && ')}`;
      configQuery += `}`;
    }
    configQuery += `${queryAfterClosingBracket}`;
  } else {
    configQuery = `{${queryParts.join(' && ')}} | ${targetQuery}`;
  }

  return configQuery;
};

const getConfig = (series: Series, query: string, instanceSettings: DataSourceInstanceSettings) => {
  const commonConfig = {
    displayNameFromDS: series.key,
    noValue: '<no value>',
    links: [
      {
        title: 'Query in explore',
        url: '',
        internal: {
          datasourceUid: instanceSettings.uid,
          datasourceName: instanceSettings.name,
          query: {
            query,
            queryType: 'traceql',
          },
        },
      },
    ],
  };

  if (series.value.type === 7) {
    return {
      ...commonConfig,
      unit: 'ns',
    };
  }
  return { ...commonConfig };
};

const NO_VALUE = '';

const getMetricValue = (series: Series) => {
  if (!series.value.type) {
    return NO_VALUE;
  }

  switch (series.value.type) {
    case 3:
      return series.value.n;
    case 4:
      return series.value.f;
    case 5:
      return series.value.s;
    case 6:
      return series.value.b;
    case 7:
      return series.value.d;
    case 8:
      return getSpanStatusCode(series.value.status);
    case 9:
      return getSpanKind(series.value.kind);
    default:
      return NO_VALUE;
  }
};

// Values set according to Tempo enum: https://github.com/grafana/tempo/blob/main/pkg/traceql/enum_statics.go
const getSpanStatusCode = (statusCode: number | undefined) => {
  if (!statusCode) {
    return NO_VALUE;
  }

  switch (statusCode) {
    case 0:
      return 'error';
    case 1:
      return 'ok';
    default:
      return 'unset';
  }
};

// Values set according to Tempo enum: https://github.com/grafana/tempo/blob/main/pkg/traceql/enum_statics.go
const getSpanKind = (kind: number | undefined) => {
  if (!kind) {
    return NO_VALUE;
  }

  switch (kind) {
    case 1:
      return 'internal';
    case 2:
      return 'client';
    case 3:
      return 'server';
    case 4:
      return 'producer';
    case 5:
      return 'consumer';
    default:
      return 'unspecified';
  }
};

const getPercentileRow = (name: string) => {
  return {
    name: name,
    type: FieldType.number,
    config: {
      displayNameFromDS: name,
      unit: 'ns',
      custom: {
        width: 150,
      },
    },
  };
};

const getNumberForMetric = (metric: string) => {
  const number = parseInt(metric, 10);
  return isNaN(number) ? 0 : number;
};

export const emptyResponse = new MutableDataFrame({
  name: 'Metrics Summary',
  refId: 'metrics-summary',
  fields: [],
  meta: {
    preferredVisualisationType: 'table',
  },
});
