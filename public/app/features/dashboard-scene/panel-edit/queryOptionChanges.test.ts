import { getPanelPlugin } from '@grafana/data/test';
import { setPluginImportUtils } from '@grafana/runtime';
import { SceneDataTransformer, SceneQueryRunner, VizPanel } from '@grafana/scenes';

import { DashboardScene } from '../scene/DashboardScene';
import { DefaultGridLayoutManager } from '../scene/layout-default/DefaultGridLayoutManager';
import { PanelTimeRange } from '../scene/panel-timerange/PanelTimeRange';
import { DashboardInteractions } from '../utils/interactions';

import { getChangedQueryOptions, getQueryOptionState, trackQueryOptionChanges } from './queryOptionChanges';

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
  return { panel, queryRunner };
}

type Fixture = ReturnType<typeof setup>;

describe('getChangedQueryOptions', () => {
  it('returns nothing when the panel state did not change', () => {
    const { panel, queryRunner } = setup();
    const before = getQueryOptionState(panel, queryRunner);

    expect(getChangedQueryOptions(before, getQueryOptionState(panel, queryRunner))).toEqual([]);
  });

  it.each<{ name: string; change: (fixture: Fixture) => void; expected: string[] }>([
    {
      name: 'max data points',
      change: ({ queryRunner }) => queryRunner.setState({ maxDataPoints: 100 }),
      expected: ['max_data_points'],
    },
    {
      name: 'min interval',
      change: ({ queryRunner }) => queryRunner.setState({ minInterval: '5m' }),
      expected: ['min_interval'],
    },
    {
      name: 'cache timeout',
      change: ({ queryRunner }) => queryRunner.setState({ cacheTimeout: '120' }),
      expected: ['cache_timeout'],
    },
    {
      name: 'query caching TTL',
      change: ({ queryRunner }) => queryRunner.setState({ queryCachingTTL: 300 }),
      expected: ['query_caching_ttl'],
    },
    {
      name: 'relative time',
      change: ({ panel }) => panel.setState({ $timeRange: new PanelTimeRange({ timeFrom: '6h' }) }),
      expected: ['relative_time'],
    },
    {
      name: 'time shift and hide time info',
      change: ({ panel }) =>
        panel.setState({ $timeRange: new PanelTimeRange({ timeFrom: '1h', timeShift: '1d', hideTimeOverride: true }) }),
      expected: ['time_shift', 'hide_time_info'],
    },
    {
      name: 'the time range being removed',
      change: ({ panel }) => panel.setState({ $timeRange: undefined }),
      expected: ['relative_time'],
    },
  ])('returns $expected when $name changes', ({ change, expected }) => {
    const fixture = setup();
    const before = getQueryOptionState(fixture.panel, fixture.queryRunner);

    change(fixture);

    expect(getChangedQueryOptions(before, getQueryOptionState(fixture.panel, fixture.queryRunner))).toEqual(expected);
  });

  it('treats an unset option and a cleared or false one as the same', () => {
    const { panel, queryRunner } = setup();
    queryRunner.setState({ minInterval: undefined });
    const before = getQueryOptionState(panel, queryRunner);

    queryRunner.setState({ minInterval: '' });
    panel.setState({ $timeRange: new PanelTimeRange({ timeFrom: '1h', hideTimeOverride: false }) });

    expect(getChangedQueryOptions(before, getQueryOptionState(panel, queryRunner))).toEqual([]);
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
