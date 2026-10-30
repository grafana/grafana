import { type DataSourceInstanceSettings } from '@grafana/data';
import { setDataSourceInstanceSettings } from '@grafana/runtime/internal';
import { SceneDataTransformer, SceneGridItem, SceneGridLayout, SceneQueryRunner, VizPanel } from '@grafana/scenes';

import { hasScopeFilteredDatasource } from './scopeFilteredDatasources';

const DEFAULT_DS_NAME = 'default-ds';

function makeDsSettings(uid: string, type: string, opts: { isDefault?: boolean } = {}): DataSourceInstanceSettings {
  return {
    uid,
    name: uid,
    type,
    access: 'proxy',
    jsonData: {},
    readOnly: false,
    isDefault: opts.isDefault ?? false,
    meta: { id: type } as DataSourceInstanceSettings['meta'],
  } as DataSourceInstanceSettings;
}

beforeEach(() => {
  // Seeds the async instance-settings cache hasScopeFilteredDatasource resolves refs against.
  // The default entry stands in for the instance's configured default datasource (Prometheus
  // here), which a query/panel with no datasource ref at all falls back to at query time.
  setDataSourceInstanceSettings(
    {
      'mysql-ds': makeDsSettings('mysql-ds', 'mysql'),
      'loki-ds': makeDsSettings('loki-ds', 'loki'),
      'prom-ds': makeDsSettings('prom-ds', 'prometheus'),
      'influx-ds': makeDsSettings('influx-ds', 'influxdb'),
      [DEFAULT_DS_NAME]: makeDsSettings(DEFAULT_DS_NAME, 'prometheus', { isDefault: true }),
    },
    DEFAULT_DS_NAME
  );
});

function buildScene(panels: VizPanel[]) {
  return new SceneGridLayout({
    children: panels.map(
      (panel, i) => new SceneGridItem({ key: `grid-item-${i}`, x: 0, y: i, width: 24, height: 8, body: panel })
    ),
  });
}

describe('hasScopeFilteredDatasource', () => {
  it('returns false when there are no panels', async () => {
    expect(await hasScopeFilteredDatasource(buildScene([]))).toBe(false);
  });

  it('returns false when no panel targets Loki or Prometheus', async () => {
    const panel = new VizPanel({
      key: 'panel-1',
      pluginId: 'table',
      $data: new SceneQueryRunner({ datasource: { type: 'mysql', uid: 'mysql-ds' }, queries: [{ refId: 'A' }] }),
    });

    expect(await hasScopeFilteredDatasource(buildScene([panel]))).toBe(false);
  });

  it('returns true when a panel targets Loki', async () => {
    const panel = new VizPanel({
      key: 'panel-1',
      pluginId: 'table',
      $data: new SceneQueryRunner({ datasource: { type: 'loki', uid: 'loki-ds' }, queries: [{ refId: 'A' }] }),
    });

    expect(await hasScopeFilteredDatasource(buildScene([panel]))).toBe(true);
  });

  it('returns true when the query runner is wrapped in a SceneDataTransformer', async () => {
    // getQueryRunnerFor has to recurse through the transformer to find the runner.
    const panel = new VizPanel({
      key: 'panel-1',
      pluginId: 'table',
      $data: new SceneDataTransformer({
        transformations: [],
        $data: new SceneQueryRunner({ datasource: { type: 'loki', uid: 'loki-ds' }, queries: [{ refId: 'A' }] }),
      }),
    });

    expect(await hasScopeFilteredDatasource(buildScene([panel]))).toBe(true);
  });

  it('resolves the default datasource when neither the query nor the runner has one set', async () => {
    // A panel with no datasource configured falls back to the instance's default datasource at
    // query time, and scope filters still apply to that. The stand-in default here is Prometheus.
    const panel = new VizPanel({
      key: 'panel-1',
      pluginId: 'table',
      $data: new SceneQueryRunner({ queries: [{ refId: 'A' }] }),
    });

    expect(await hasScopeFilteredDatasource(buildScene([panel]))).toBe(true);
  });

  it('returns true when a Prometheus query is nested inside a mixed-datasource panel', async () => {
    // A mixed panel's own datasource type is 'mixed'; the real type lives on each query.
    const panel = new VizPanel({
      key: 'panel-1',
      pluginId: 'table',
      $data: new SceneQueryRunner({
        datasource: { type: 'mixed', uid: '-- Mixed --' },
        queries: [
          { refId: 'A', datasource: { type: 'mysql', uid: 'mysql-ds' } },
          { refId: 'B', datasource: { type: 'prometheus', uid: 'prom-ds' } },
        ],
      }),
    });

    expect(await hasScopeFilteredDatasource(buildScene([panel]))).toBe(true);
  });

  it('returns false for a mixed-datasource panel whose queries are all unrelated types', async () => {
    const panel = new VizPanel({
      key: 'panel-1',
      pluginId: 'table',
      $data: new SceneQueryRunner({
        datasource: { type: 'mixed', uid: '-- Mixed --' },
        queries: [
          { refId: 'A', datasource: { type: 'mysql', uid: 'mysql-ds' } },
          { refId: 'B', datasource: { type: 'influxdb', uid: 'influx-ds' } },
        ],
      }),
    });

    expect(await hasScopeFilteredDatasource(buildScene([panel]))).toBe(false);
  });

  it('returns false for a panel with no query runner (e.g. a text panel)', async () => {
    const panel = new VizPanel({ key: 'panel-1', pluginId: 'text' });

    expect(await hasScopeFilteredDatasource(buildScene([panel]))).toBe(false);
  });
});
