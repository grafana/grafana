import { SpanKind, SpanStatusCode } from '@opentelemetry/api';

import { DataSourceInstanceSettings, FieldDTO, FieldType, MutableDataFrame, sortDataFrame } from '@grafana/data';

type MetricsSummary = {
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
  spanCount: string;
  errorPercentage: string;
  p50: string;
  p90: string;
  p95: string;
  p99: string;
  [key: string]: string | number;
};

export function createTableFrameFromMetricsQuery(
  data: MetricsSummary[],
  instanceSettings: DataSourceInstanceSettings,
  isLoading: boolean
) {
  let frame;
  if (isLoading) {
    frame = new MutableDataFrame({
      name: 'Metrics Summary',
      refId: 'metrics-summary',
      fields: [
        { name: 'state', type: FieldType.string, config: { displayNameFromDS: 'State', custom: { width: 300 } } },
      ],
      meta: {
        preferredVisualisationType: 'table',
      },
    });
    frame.add({
      state: 'Loading..',
    });
  } else {
    const dynamicMetrics: Record<string, FieldDTO> = {};

    data.map((res: MetricsSummary) => {
      res.series.map((series: Series) => {
        return !dynamicMetrics[series.key]
          ? (dynamicMetrics[series.key] = {
              name: `${series.key}_summary`,
              type: FieldType.string,
              config: getMetricConfig(series, instanceSettings),
            })
          : dynamicMetrics[series.key];
      });
    });

    frame = new MutableDataFrame({
      name: 'Metrics Summary',
      refId: 'metrics-summary',
      fields: [
        ...Object.values(dynamicMetrics).sort((a, b) => a.name.localeCompare(b.name)),
        {
          name: 'spanCount',
          type: FieldType.string,
          config: { displayNameFromDS: 'Span count', custom: { width: 150 } },
        },
        {
          name: 'errorPercentage',
          type: FieldType.string,
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

    if (!data?.length) {
      return frame;
    }

    const metricsData = data.map(transformToMetricsData);
    for (const trace of metricsData) {
      frame.add(trace);
    }
    frame = sortDataFrame(frame, 0);
  }

  return [frame];
}

const transformToMetricsData = (data: MetricsSummary) => {
  const errorPercentage = data.errorSpanCount
    ? ((parseInt(data.errorSpanCount, 10) / parseInt(data.spanCount, 10)) * 100).toString()
    : '';

  const metricsData: MetricsData = {
    spanCount: data.spanCount,
    errorPercentage,
    p50: data.p50,
    p90: data.p90,
    p95: data.p95,
    p99: data.p99,
  };

  data.series.map((series: Series) => {
    metricsData[`${series.key}_summary`] = getMetricValue(series);
  });

  return metricsData;
};

const getMetricConfig = (series: Series, instanceSettings: DataSourceInstanceSettings) => {
  const isNumber = series.value.type === 3 || series.value.type === 4 || series.value.type === 7;
  let query = `{${series.key}=`;
  query += isNumber ? '' : '"';
  query += '${__value.raw}';
  query += isNumber ? '}' : '"}';

  const commonConfig = {
    displayNameFromDS: series.key,
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

const getMetricValue = (series: Series) => {
  if (!series.value.type) {
    return 'NULL';
  }

  switch (series.value.type) {
    case 3:
      return series.value.n || 0;
    case 4:
      return series.value.f || 0;
    case 5:
      return series.value.s || '';
    case 6:
      return series.value.b || '';
    case 7:
      return series.value.d || 0;
    case 8:
      return series.value.status ? SpanStatusCode[series.value.status].toLowerCase() : '';
    case 9:
      return series.value.kind ? SpanKind[series.value.kind].toLowerCase() : '';
    default:
      return 'NULL';
  }
};

const getPercentileRow = (name: string) => {
  return {
    name: name,
    type: FieldType.string,
    config: {
      displayNameFromDS: name,
      unit: 'ns',
      custom: {
        width: 150,
      },
    },
  };
};
