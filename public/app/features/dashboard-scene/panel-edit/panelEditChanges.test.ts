import { SceneDataTransformer, SceneQueryRunner, VizPanel } from '@grafana/scenes';

import { VizPanelLinks, VizPanelLinksMenu } from '../scene/PanelLinks';
import { AutoGridItem } from '../scene/layout-auto-grid/AutoGridItem';
import { DashboardGridItem } from '../scene/layout-default/DashboardGridItem';
import { PanelTimeRange } from '../scene/panel-timerange/PanelTimeRange';

import { diffPanelEditSnapshots, takePanelEditSnapshot } from './panelEditChanges';

const NO_CHANGES = {
  options: false,
  field_config: false,
  overrides: false,
  queries: false,
  transformations: false,
  panel_info: false,
  repeat: false,
};

function buildPanel() {
  const queryRunner = new SceneQueryRunner({
    queries: [{ refId: 'A' }],
    datasource: { uid: 'ds1' },
    maxDataPoints: 500,
  });
  const transformer = new SceneDataTransformer({ transformations: [], $data: queryRunner });
  const links = new VizPanelLinks({ rawLinks: [], menu: new VizPanelLinksMenu({}) });
  const options: Record<string, unknown> = { legend: { showLegend: true } };
  const panel = new VizPanel({
    key: 'panel-1',
    pluginId: 'timeseries',
    title: 'Title',
    options,
    fieldConfig: { defaults: { unit: 'short' }, overrides: [] },
    titleItems: [links],
    $data: transformer,
  });
  const gridItem = new DashboardGridItem({ body: panel });

  return { panel, gridItem, queryRunner, transformer, links };
}

type Fixture = ReturnType<typeof buildPanel>;

describe('panelEditChanges', () => {
  it('reports no changed area when nothing changed', () => {
    const { panel, gridItem } = buildPanel();

    const before = takePanelEditSnapshot(panel, gridItem);

    expect(diffPanelEditSnapshots(before, takePanelEditSnapshot(panel, gridItem))).toEqual(NO_CHANGES);
  });

  it.each<{ name: string; area: string; change: (fixture: Fixture) => void }>([
    {
      name: 'a panel option',
      area: 'options',
      change: ({ panel }) => panel.setState({ options: { legend: { showLegend: false } } }),
    },
    {
      name: 'a field config default',
      area: 'field_config',
      change: ({ panel }) => panel.setState({ fieldConfig: { defaults: { unit: 'ms' }, overrides: [] } }),
    },
    {
      name: 'an override',
      area: 'overrides',
      change: ({ panel }) =>
        panel.setState({
          fieldConfig: {
            defaults: { unit: 'short' },
            overrides: [{ matcher: { id: 'byName', options: 'A' }, properties: [] }],
          },
        }),
    },
    {
      name: 'a query',
      area: 'queries',
      change: ({ queryRunner }) => queryRunner.setState({ queries: [{ refId: 'A' }, { refId: 'B' }] }),
    },
    {
      name: 'the data source',
      area: 'queries',
      change: ({ queryRunner }) => queryRunner.setState({ datasource: { uid: 'ds2' } }),
    },
    {
      name: 'a query option',
      area: 'queries',
      change: ({ queryRunner }) => queryRunner.setState({ maxDataPoints: 100 }),
    },
    {
      name: 'a relative time override',
      area: 'queries',
      change: ({ panel }) => panel.setState({ $timeRange: new PanelTimeRange({ timeFrom: '1h' }) }),
    },
    {
      name: 'a transformation',
      area: 'transformations',
      change: ({ transformer }) => transformer.setState({ transformations: [{ id: 'organize', options: {} }] }),
    },
    {
      name: 'the title',
      area: 'panel_info',
      change: ({ panel }) => panel.setState({ title: 'New title' }),
    },
    {
      name: 'the transparent background',
      area: 'panel_info',
      change: ({ panel }) => panel.setState({ displayMode: 'transparent' }),
    },
    {
      name: 'a panel link',
      area: 'panel_info',
      change: ({ links }) => links.setState({ rawLinks: [{ title: 'Docs', url: '/docs' }] }),
    },
    {
      name: 'the repeat variable',
      area: 'repeat',
      change: ({ gridItem }) => gridItem.setState({ variableName: 'server' }),
    },
    {
      name: 'the repeat max per row',
      area: 'repeat',
      change: ({ gridItem }) => gridItem.setState({ maxPerRow: 4 }),
    },
  ])('reports only $area as changed when $name changes', ({ area, change }) => {
    const fixture = buildPanel();
    const before = takePanelEditSnapshot(fixture.panel, fixture.gridItem);

    change(fixture);

    expect(diffPanelEditSnapshots(before, takePanelEditSnapshot(fixture.panel, fixture.gridItem))).toEqual({
      ...NO_CHANGES,
      [area]: true,
    });
  });

  it('treats an option set to undefined like a missing option', () => {
    const { panel, gridItem } = buildPanel();
    const before = takePanelEditSnapshot(panel, gridItem);

    panel.setState({ options: { legend: { showLegend: true }, tooltip: undefined } });

    expect(diffPanelEditSnapshots(before, takePanelEditSnapshot(panel, gridItem)).options).toBe(false);
  });

  it('reports a change that was reverted as unchanged', () => {
    const { panel, gridItem } = buildPanel();
    const before = takePanelEditSnapshot(panel, gridItem);

    panel.setState({ title: 'New title' });
    panel.setState({ title: 'Title' });

    expect(diffPanelEditSnapshots(before, takePanelEditSnapshot(panel, gridItem)).panel_info).toBe(false);
  });

  it('reads the repeat variable from an auto grid item', () => {
    const panel = new VizPanel({ key: 'panel-2', pluginId: 'timeseries' });
    const autoGridItem = new AutoGridItem({ body: panel });
    const before = takePanelEditSnapshot(panel, autoGridItem);

    autoGridItem.setState({ variableName: 'server' });

    expect(diffPanelEditSnapshots(before, takePanelEditSnapshot(panel, autoGridItem)).repeat).toBe(true);
  });
});
