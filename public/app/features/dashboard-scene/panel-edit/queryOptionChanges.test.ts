import { getPanelPlugin } from '@grafana/data/test';
import { setPluginImportUtils } from '@grafana/runtime';
import { SceneDataTransformer, SceneQueryRunner, VizPanel } from '@grafana/scenes';
import { type QueryGroupOptions } from 'app/types/query';

import { DashboardScene } from '../scene/DashboardScene';
import { DefaultGridLayoutManager } from '../scene/layout-default/DefaultGridLayoutManager';
import { PanelTimeRange } from '../scene/panel-timerange/PanelTimeRange';
import { DashboardInteractions } from '../utils/interactions';

import { getChangedQueryOptions, trackQueryOptionChanges } from './queryOptionChanges';

setPluginImportUtils({
  importPanelPlugin: () => Promise.resolve(getPanelPlugin({})),
  getPanelPluginFromCache: () => undefined,
});

function setup() {
  const queryRunner = new SceneQueryRunner({
    queries: [{ refId: 'A' }],
    maxDataPoints: 500,
    minInterval: '1m',
    cacheTimeout: '60',
  });
  const panel = new VizPanel({
    key: 'panel-9',
    pluginId: 'timeseries',
    $timeRange: new PanelTimeRange({ timeFrom: '1h' }),
    $data: new SceneDataTransformer({ transformations: [], $data: queryRunner }),
  });
  new DashboardScene({ isEditing: true, body: DefaultGridLayoutManager.fromVizPanels([panel]) });

  const current: QueryGroupOptions = {
    queries: [],
    dataSource: { uid: 'ds1' },
    maxDataPoints: 500,
    minInterval: '1m',
    cacheTimeout: '60',
    timeRange: { from: '1h' },
  };
  return { panel, queryRunner, current };
}

describe('getChangedQueryOptions', () => {
  it('returns nothing when the options match the panel', () => {
    const { panel, queryRunner, current } = setup();

    expect(getChangedQueryOptions(panel, queryRunner, current)).toEqual([]);
  });

  it.each<{ name: string; change: Partial<QueryGroupOptions>; expected: string[] }>([
    { name: 'max data points', change: { maxDataPoints: 100 }, expected: ['max_data_points'] },
    { name: 'min interval', change: { minInterval: '5m' }, expected: ['min_interval'] },
    { name: 'cache timeout', change: { cacheTimeout: '120' }, expected: ['cache_timeout'] },
    { name: 'query caching TTL', change: { queryCachingTTL: 300 }, expected: ['query_caching_ttl'] },
    { name: 'relative time', change: { timeRange: { from: '6h' } }, expected: ['relative_time'] },
    {
      name: 'time shift and hide time info',
      change: { timeRange: { from: '1h', shift: '1d', hide: true } },
      expected: ['time_shift', 'hide_time_info'],
    },
  ])('returns $expected when $name changes', ({ change, expected }) => {
    const { panel, queryRunner, current } = setup();

    expect(getChangedQueryOptions(panel, queryRunner, { ...current, ...change })).toEqual(expected);
  });

  it('treats a cleared field and an unset option as the same', () => {
    const { panel, queryRunner, current } = setup();
    queryRunner.setState({ minInterval: undefined });

    expect(
      getChangedQueryOptions(panel, queryRunner, {
        ...current,
        minInterval: '',
        timeRange: { from: '1h', hide: false },
      })
    ).toEqual([]);
  });
});

describe('trackQueryOptionChanges', () => {
  it('reports each changed option by name, never its value', () => {
    const { panel } = setup();
    const panelSettingChanged = jest.spyOn(DashboardInteractions, 'panelSettingChanged').mockImplementation();

    trackQueryOptionChanges(panel, ['max_data_points', 'relative_time'], 'next');

    expect(panelSettingChanged.mock.calls).toEqual([
      [
        {
          item: 'change_query_option',
          source: 'panel_editor',
          panel_type: 'timeseries',
          panel_id: 9,
          option: 'max_data_points',
          editor: 'next',
        },
      ],
      [
        {
          item: 'change_query_option',
          source: 'panel_editor',
          panel_type: 'timeseries',
          panel_id: 9,
          option: 'relative_time',
          editor: 'next',
        },
      ],
    ]);
    panelSettingChanged.mockRestore();
  });
});
