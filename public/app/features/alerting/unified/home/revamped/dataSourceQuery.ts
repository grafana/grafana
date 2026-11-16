import { lastValueFrom } from 'rxjs';

import { type TimeRange } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import { type DataSourceRef } from '@grafana/schema';

/** One series from a query result: its labels and its values in time order. */
export interface QuerySeries {
  labels: Record<string, string>;
  values: number[];
  /** Epoch milliseconds of each value. */
  times: number[];
}

interface FrameField {
  name: string;
  type?: string;
  labels?: Record<string, string>;
}

interface FrameJSON {
  schema?: { fields: FrameField[] };
  data?: { values: unknown[][] };
}

interface QueryResponse {
  results: Record<string, { frames?: FrameJSON[]; error?: string }>;
}

export interface HomeQuery {
  refId: string;
  expr: string;
  /** Prometheus and Loki name this differently; the caller passes the data source's own fields. */
  [field: string]: unknown;
}

/**
 * Runs queries against one data source through the query API and returns the series of each
 * query by refId. A query that fails returns no series rather than failing the others.
 */
export async function queryDataSource(
  datasource: DataSourceRef,
  queries: HomeQuery[],
  range: TimeRange
): Promise<Record<string, QuerySeries[]>> {
  const response = await lastValueFrom(
    getBackendSrv().fetch<QueryResponse>({
      url: '/api/ds/query',
      method: 'POST',
      data: {
        queries: queries.map((query) => ({ ...query, datasource })),
        from: String(range.from.valueOf()),
        to: String(range.to.valueOf()),
      },
      showErrorAlert: false,
    })
  );

  return Object.fromEntries(
    queries.map(({ refId }) => [refId, (response.data.results[refId]?.frames ?? []).map(toSeries)])
  );
}

function toSeries(frame: FrameJSON): QuerySeries {
  const fields = frame.schema?.fields ?? [];
  const valueIndex = fields.findIndex((field) => field.type === 'number');
  const timeIndex = fields.findIndex((field) => field.type === 'time');
  const values = valueIndex >= 0 ? (frame.data?.values[valueIndex] ?? []) : [];
  const times = timeIndex >= 0 ? (frame.data?.values[timeIndex] ?? []) : [];

  const series: QuerySeries = {
    labels: valueIndex >= 0 ? (fields[valueIndex].labels ?? {}) : {},
    values: [],
    times: [],
  };
  values.forEach((value, index) => {
    if (typeof value === 'number') {
      series.values.push(value);
      series.times.push(Number(times[index] ?? 0));
    }
  });
  return series;
}
