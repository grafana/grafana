import { SceneGridItem, SceneGridLayout, SceneQueryRunner, VizPanel } from '@grafana/scenes';

import { hasScopeFilteredDatasource } from './scopeFilteredDatasources';

function buildScene(panels: VizPanel[]) {
  return new SceneGridLayout({
    children: panels.map(
      (panel, i) => new SceneGridItem({ key: `grid-item-${i}`, x: 0, y: i, width: 24, height: 8, body: panel })
    ),
  });
}

describe('hasScopeFilteredDatasource', () => {
  it('returns false when there are no panels', () => {
    expect(hasScopeFilteredDatasource(buildScene([]))).toBe(false);
  });

  it('returns false when no panel targets Loki or Prometheus', () => {
    const panel = new VizPanel({
      key: 'panel-1',
      pluginId: 'table',
      $data: new SceneQueryRunner({ datasource: { type: 'mysql', uid: 'mysql-ds' }, queries: [{ refId: 'A' }] }),
    });

    expect(hasScopeFilteredDatasource(buildScene([panel]))).toBe(false);
  });

  it('returns true when a panel targets Loki', () => {
    const panel = new VizPanel({
      key: 'panel-1',
      pluginId: 'table',
      $data: new SceneQueryRunner({ datasource: { type: 'loki', uid: 'loki-ds' }, queries: [{ refId: 'A' }] }),
    });

    expect(hasScopeFilteredDatasource(buildScene([panel]))).toBe(true);
  });

  it('returns true when a Prometheus query is nested inside a mixed-datasource panel', () => {
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

    expect(hasScopeFilteredDatasource(buildScene([panel]))).toBe(true);
  });

  it('returns false for a mixed-datasource panel whose queries are all unrelated types', () => {
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

    expect(hasScopeFilteredDatasource(buildScene([panel]))).toBe(false);
  });

  it('returns false for a panel with no query runner (e.g. a text panel)', () => {
    const panel = new VizPanel({ key: 'panel-1', pluginId: 'text' });

    expect(hasScopeFilteredDatasource(buildScene([panel]))).toBe(false);
  });
});
