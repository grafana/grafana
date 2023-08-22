import {
  DataSourceInstanceSettings,
  FieldDTO,
  FieldType,
  LoadingState,
  MutableDataFrame,
  sortDataFrame,
} from '@grafana/data';

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

export function createTableFrameFromMetricsSummaryQuery(
  data: MetricsSummary[],
  targetQuery: string,
  instanceSettings: DataSourceInstanceSettings,
  state: LoadingState
) {
  let frame;

  if (state === LoadingState.Error) {
    frame = emptyResponse;
  } else if (state === LoadingState.Loading) {
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
      state: 'Loading...',
    });
  } else {
    const dynamicMetrics: Record<string, FieldDTO> = {};
    data.map((res: MetricsSummary) => {
      const configQuery = getConfigQuery(res.series, targetQuery);
      res.series.map((series: Series) => {
        return !dynamicMetrics[series.key]
          ? (dynamicMetrics[series.key] = {
              name: `${series.key}`,
              type: FieldType.string,
              config: getConfig(series, configQuery, instanceSettings),
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
          name: 'kind',
          type: FieldType.string,
          config: { displayNameFromDS: 'Kind', custom: { width: 150 } },
        },
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
    kind: 'server', // so the user knows all results are of kind = server
    spanCount: data.spanCount,
    errorPercentage,
    p50: data.p50,
    p90: data.p90,
    p95: data.p95,
    p99: data.p99,
  };

  data.series.map((series: Series) => {
    metricsData[`${series.key}`] = getMetricValue(series) || '';
  });

  return metricsData;
};

const getConfigQuery = (series: Series[], targetQuery: string) => {
  const queryParts = series.map((x: Series) => {
    const isNumber = x.value.type === 3 || x.value.type === 4 || x.value.type === 7;
    const surround = isNumber ? '' : '"';
    return `${x.key}=${surround}` + '${__data.fields["' + x.key + '"]}' + `${surround}`;
  });

  const closingBracketIndex = targetQuery.indexOf('}');
  const queryAfterClosingBracket = targetQuery.substring(closingBracketIndex + 1);

  let updatedTargetQuery = targetQuery.substring(0, closingBracketIndex);
  if (queryParts.length > 0) {
    updatedTargetQuery += targetQuery.replace(/\s/g, '').includes('{}') ? '' : ' && ';
    updatedTargetQuery += `${queryParts.join(' && ')}`;
    updatedTargetQuery += `}`;
  }
  updatedTargetQuery += `${queryAfterClosingBracket}`;

  return updatedTargetQuery;
};

const getConfig = (series: Series, query: string, instanceSettings: DataSourceInstanceSettings) => {
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
      return 'NULL';
  }
};

// Values set according to Tempo enum: https://github.com/grafana/tempo/blob/main/pkg/traceql/enum_statics.go
const getSpanStatusCode = (statusCode: number | undefined) => {
  if (!statusCode) {
    return '';
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
    return '';
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

const emptyResponse = new MutableDataFrame({
  name: 'Metrics Summary',
  refId: 'metrics-summary',
  fields: [],
  meta: {
    preferredVisualisationType: 'table',
  },
});
