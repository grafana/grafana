// Prototype-only. Not internationalized.
// A fake Loki (logs) data source registered entirely on the frontend so the
// Mixed-datasource demo has a genuine non-Prometheus query to sit alongside the
// fake Prometheus one. Its whole reason to exist is to show that the metrics
// browser has nothing to offer a logs data source — so the query() executor is
// deliberately minimal (a handful of deterministic log lines) just so "Run
// query" doesn't error.
/* eslint-disable @typescript-eslint/consistent-type-assertions -- prototype-only: reaching into DatasourceSrv internals */

import { type Observable, of } from 'rxjs';

import {
  createDataFrame,
  DataSourceApi,
  type DataFrame,
  type DataQuery,
  type DataQueryRequest,
  type DataQueryResponse,
  type DataSourceInstanceSettings,
  type DataSourceJsonData,
  FieldType,
  LoadingState,
  PluginType,
  type TestDataSourceResponse,
} from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';

export const FAKE_LOKI_UID = 'prom-proto-fake-loki';
export const FAKE_LOKI_NAME = 'Fake Loki (prototype)';

// eslint-disable-next-line @grafana/no-restricted-img-srcs -- prototype-only: reuse the built-in Loki plugin icon
const LOKI_LOGO = 'public/app/plugins/datasource/loki/img/loki_icon.svg';

// A believable-looking rotation of log lines for the mock executor.
const SAMPLE_LINES = [
  'level=info ts=... caller=main.go:214 msg="server listening" addr=:3100',
  'level=info ts=... caller=http.go:194 msg="GET /api/v1/query" status=200 duration=12ms',
  'level=warn ts=... caller=ingester.go:552 msg="stream limit approaching" tenant=fake user=demo',
  'level=error ts=... caller=querier.go:311 msg="query timeout" query="{app=\\"api\\"}" err="context deadline exceeded"',
  'level=info ts=... caller=compactor.go:88 msg="compaction finished" blocks=4 duration=2.1s',
];

function buildInstanceSettings(): DataSourceInstanceSettings<DataSourceJsonData> {
  return {
    id: 0,
    uid: FAKE_LOKI_UID,
    type: 'loki',
    name: FAKE_LOKI_NAME,
    readOnly: true,
    access: 'proxy',
    jsonData: {},
    meta: {
      id: 'loki',
      name: 'Loki',
      type: PluginType.datasource,
      // The only flag getList() needs to treat this as a queryable data source.
      logs: true,
      metrics: false,
      info: {
        author: { name: 'Grafana Labs' },
        description: 'Prototype-only fake Loki data source',
        links: [],
        logos: { small: LOKI_LOGO, large: LOKI_LOGO },
        screenshots: [],
        updated: '',
        version: '',
      },
      module: '',
      baseUrl: '',
    },
  };
}

class FakeLokiDatasource extends DataSourceApi<DataQuery> {
  query(request: DataQueryRequest<DataQuery>): Observable<DataQueryResponse> {
    const frames: DataFrame[] = [];
    const to = request.range.to.valueOf();
    for (const target of request.targets) {
      const times: number[] = [];
      const lines: string[] = [];
      for (let i = 0; i < 25; i++) {
        times.push(to - i * 4000);
        lines.push(SAMPLE_LINES[i % SAMPLE_LINES.length]);
      }
      frames.push(
        createDataFrame({
          refId: target.refId,
          meta: { preferredVisualisationType: 'logs' },
          fields: [
            { name: 'Time', type: FieldType.time, values: times },
            { name: 'Line', type: FieldType.string, values: lines },
          ],
        })
      );
    }
    return of({ data: frames, state: LoadingState.Done });
  }

  testDatasource(): Promise<TestDataSourceResponse> {
    return Promise.resolve({ status: 'success', message: '' });
  }
}

// Make the fake Loki data source both selectable (in the per-row picker) and
// queryable. Idempotent — safe to call on every prototype mount.
//
// Prototype-only hack: registerRuntimeDataSource() would make the instance
// queryable but leaves it out of getList() (the picker's source of truth reads
// settingsMapByName, which runtime registration skips). So we inject directly
// into the concrete DatasourceSrv's private lookup maps instead.
export function ensureFakeLokiRegistered(): void {
  const srv = getDataSourceSrv();
  const internal = srv as unknown as {
    settingsMapByName?: Record<string, DataSourceInstanceSettings>;
    settingsMapByUid?: Record<string, DataSourceInstanceSettings>;
    settingsMapById?: Record<string, DataSourceInstanceSettings>;
    datasources?: Record<string, DataSourceApi>;
  };
  if (!internal.settingsMapByName || !internal.settingsMapByUid || !internal.datasources) {
    // Unexpected srv shape — bail rather than throw in a prototype.
    return;
  }
  if (internal.settingsMapByUid[FAKE_LOKI_UID]) {
    return; // already registered this session
  }
  const settings = buildInstanceSettings();
  internal.settingsMapByName[settings.name] = settings;
  internal.settingsMapByUid[FAKE_LOKI_UID] = settings;
  if (internal.settingsMapById && settings.id) {
    internal.settingsMapById[settings.id] = settings;
  }
  internal.datasources[FAKE_LOKI_UID] = new FakeLokiDatasource(settings);
}
