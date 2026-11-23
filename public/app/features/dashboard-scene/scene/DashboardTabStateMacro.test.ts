import { createDataFrame, getLinksSupplier } from '@grafana/data';
import { sceneGraph, SceneTimeRange, VizPanel } from '@grafana/scenes';

import { registerDashboardMacro } from './DashboardMacro';
import { DashboardScene } from './DashboardScene';
import { AutoGridItem } from './layout-auto-grid/AutoGridItem';
import { AutoGridLayoutManager } from './layout-auto-grid/AutoGridLayoutManager';
import { RowItem } from './layout-rows/RowItem';
import { RowsLayoutManager } from './layout-rows/RowsLayoutManager';
import { TabItem } from './layout-tabs/TabItem';
import { TabsLayoutManager } from './layout-tabs/TabsLayoutManager';

describe('__url_tab_state', () => {
  let unregister: () => void;

  beforeEach(() => {
    unregister = registerDashboardMacro();
  });

  afterEach(() => unregister());

  it('preserves a selected repeated tab and its nested tab alongside the time range', () => {
    const panel = new VizPanel({ key: 'panel-1' });
    const grid = AutoGridLayoutManager.createEmpty();
    grid.state.layout.setState({ children: [new AutoGridItem({ body: panel })] });

    const errors = new TabItem({ title: 'Errors #1', layout: grid });
    const signals = new TabsLayoutManager({ tabs: [new TabItem({ title: 'Traffic' }), errors] });
    const service = new TabItem({
      title: 'Service + Detail',
      layout: new RowsLayoutManager({ rows: [new RowItem({ title: 'Signals & triage', layout: signals })] }),
    });
    const overview = new TabItem({
      title: 'Overview',
      layout: new TabsLayoutManager({ tabs: [new TabItem({ title: 'Summary' })], currentTabSlug: 'Summary' }),
      repeatedTabs: [service],
    });
    const tabs = new TabsLayoutManager({ tabs: [overview] });
    new DashboardScene({ body: tabs, $timeRange: new SceneTimeRange({ from: 'now-1h', to: 'now' }) });
    tabs.switchToTab(service);
    signals.switchToTab(errors);

    const href = getDataLinkHref(panel, '/d/test?${__url_time_range}&${__url_tab_state}&var-host=web');

    expect(href).toBe(
      '/d/test?from=now-1h&to=now&timezone=browser&dtab=Service-%2B-Detail&Overview-Service-%2B-Detail-Signals-%26-triage-dtab=Errors-%231&var-host=web'
    );
  });

  it('preserves the default tab before URL sync sets its slug', () => {
    const tabs = new TabsLayoutManager({ tabs: [new TabItem({ title: 'Overview${__url_tab_state}' })] });
    const dashboard = new DashboardScene({ body: tabs });

    expect(sceneGraph.interpolate(dashboard, '${__url_tab_state}')).toBe('dtab=Overview');
  });

  it('adds no tab parameters on a dashboard without tabs', () => {
    const dashboard = new DashboardScene({ body: AutoGridLayoutManager.createEmpty() });

    expect(sceneGraph.interpolate(dashboard, '${__url_tab_state}')).toBe('');
  });
});

function getDataLinkHref(panel: VizPanel, url: string) {
  const frame = createDataFrame({
    fields: [{ name: 'Value', values: [1], config: { links: [{ title: 'Drilldown', url }] } }],
  });
  const [link] = getLinksSupplier(frame, frame.fields[0], {}, panel.interpolate)({ valueRowIndex: 0 });
  return link.href;
}
