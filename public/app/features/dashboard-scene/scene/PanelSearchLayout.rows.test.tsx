import { act, screen, waitFor } from '@testing-library/react';
import { render, userEvent } from 'test/test-utils';

import { getPanelPlugin } from '@grafana/data/test';
import { setPluginImportUtils } from '@grafana/runtime';
import {
  CustomVariable,
  SceneGridLayout,
  SceneGridRow,
  SceneTimeRange,
  SceneVariableSet,
  TextBoxVariable,
  VizPanel,
} from '@grafana/scenes';
import { setTestFlags } from '@grafana/test-utils/unstable';

import { DashboardScene } from './DashboardScene';
import { DashboardGridItem } from './layout-default/DashboardGridItem';
import { DefaultGridLayoutManager } from './layout-default/DefaultGridLayoutManager';
import { RowRepeaterBehavior } from './layout-default/RowRepeaterBehavior';

setPluginImportUtils({
  importPanelPlugin: () =>
    Promise.resolve(getPanelPlugin({ id: 'text', skipDataQuery: true }, () => <div>Panel content</div>)),
  getPanelPluginFromCache: () => undefined,
});

setTestFlags({ dashboardNewLayouts: false });

afterAll(() => {
  setTestFlags({});
});

let nextPanelId = 1;

function panel(title: string) {
  return new DashboardGridItem({
    body: new VizPanel({ key: `panel-${nextPanelId++}`, title, pluginId: 'text' }),
    width: 12,
    height: 8,
    x: 0,
    y: 1,
  });
}

function setup(collapsed = false) {
  const matchingPanel = panel('Primary CPU');
  const otherPanel = panel('Other CPU');
  const row = new SceneGridRow({
    title: 'Cluster Alpha',
    y: 0,
    children: [matchingPanel, otherPanel],
    isCollapsed: collapsed,
  });
  const emptyRow = new SceneGridRow({ title: 'Cluster Beta', y: 9, children: [panel('Other memory')] });
  const scene = new DashboardScene({
    $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
    $variables: new SceneVariableSet({ variables: [] }),
    body: new DefaultGridLayoutManager({ grid: new SceneGridLayout({ children: [row, emptyRow] }) }),
    panelSearch: 'Primary',
    panelsPerRow: 2,
  });
  render(<scene.Component model={scene} />);
  return { scene, row, matchingPanel, otherPanel };
}

it('preserves matching rows, hides empty rows, and restores them when the filter is cleared', async () => {
  const { scene } = setup();
  expect(await screen.findByRole('button', { name: 'Collapse row with title Cluster Alpha' })).toBeVisible();
  expect(await screen.findByText('Primary CPU')).toBeVisible();
  expect(screen.queryByText('Cluster Beta')).not.toBeInTheDocument();
  expect(screen.queryByText('Other CPU')).not.toBeInTheDocument();

  act(() => scene.setState({ panelSearch: '' }));
  expect(await screen.findByRole('button', { name: 'Collapse row with title Cluster Beta' })).toBeVisible();
  expect(await screen.findByText('Other CPU')).toBeVisible();
});

it('keeps collapsed matching rows discoverable without activating their panels', async () => {
  const { row, matchingPanel } = setup(true);
  const toggle = await screen.findByRole('button', { name: 'Expand row with title Cluster Alpha' });
  expect(toggle).toBeVisible();
  expect(matchingPanel.state.body.isActive).toBe(false);
  expect(screen.queryByText('Primary CPU')).not.toBeInTheDocument();

  await userEvent.click(toggle);
  expect(await screen.findByText('Primary CPU')).toBeVisible();
  expect(row.state.isCollapsed).toBe(false);

  await userEvent.click(screen.getByRole('button', { name: 'Collapse row with title Cluster Alpha' }));
  await waitFor(() => expect(matchingPanel.state.body.isActive).toBe(false));
  expect(screen.getByRole('button', { name: 'Expand row with title Cluster Alpha' })).toBeVisible();
});

it('restores the normal layout when both search variables are inactive', async () => {
  const { scene, matchingPanel, otherPanel } = setup();
  expect(await screen.findByText('Primary CPU')).toBeVisible();
  act(() => scene.setState({ panelSearch: '', panelsPerRow: undefined }));
  expect(await screen.findByRole('button', { name: 'Collapse row with title Cluster Beta' })).toBeVisible();
  expect(await screen.findByText('Other CPU')).toBeVisible();
  expect(matchingPanel.state).toMatchObject({ x: 0, y: 1, width: 12, height: 8 });
  expect(otherPanel.state).toMatchObject({ x: 0, y: 1, width: 12, height: 8 });
});

it('opens a panel from a collapsed row in solo view without row headers or search filtering', async () => {
  const { scene, otherPanel } = setup(true);
  expect(await screen.findByRole('button', { name: 'Expand row with title Cluster Alpha' })).toBeVisible();
  act(() => scene.setState({ viewPanel: otherPanel.state.body.getPathId() }));
  expect(await screen.findByText('Other CPU')).toBeVisible();
  expect(screen.queryByText('Cluster Alpha')).not.toBeInTheDocument();
  expect(screen.queryByText('Primary CPU')).not.toBeInTheDocument();

  act(() => scene.setState({ viewPanel: undefined }));
  expect(await screen.findByRole('button', { name: 'Expand row with title Cluster Alpha' })).toBeVisible();
  expect(screen.queryByText('Other CPU')).not.toBeInTheDocument();
});

it('hides a row when its last matching panel changes title and shows the no-results message', async () => {
  const { matchingPanel, scene } = setup();
  expect(await screen.findByText('Primary CPU')).toBeVisible();
  act(() => matchingPanel.state.body.setState({ title: 'Other renamed CPU' }));
  expect(await screen.findByText('No panels matching')).toBeVisible();
  expect(screen.queryByText('Cluster Alpha')).not.toBeInTheDocument();

  act(() => scene.setState({ panelSearch: 'renamed' }));
  expect(await screen.findByText('Other renamed CPU')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Collapse row with title Cluster Alpha' })).toBeVisible();
  await waitFor(() => expect(screen.queryByText('No panels matching')).not.toBeInTheDocument());
});

it('filters titles again when a variable changes on an inactive panel', async () => {
  const metric = new TextBoxVariable({ name: 'metric', value: 'Other' });
  const item = panel('$metric CPU');
  const row = new SceneGridRow({ title: 'Variable row', children: [item] });
  const scene = new DashboardScene({
    $timeRange: new SceneTimeRange({}),
    $variables: new SceneVariableSet({ variables: [metric] }),
    body: new DefaultGridLayoutManager({ grid: new SceneGridLayout({ children: [row] }) }),
    panelSearch: 'Primary',
  });
  render(<scene.Component model={scene} />);
  expect(await screen.findByText('No panels matching')).toBeVisible();
  expect(item.state.body.isActive).toBe(false);

  act(() => metric.setValue('Primary'));
  expect(await screen.findByText('Primary CPU')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Collapse row with title Variable row' })).toBeVisible();
});

it.each(['panels', 'rows'] as const)(
  'finds matching repeated %s without retaining nonmatching rows',
  async (repeat) => {
    const server = new CustomVariable({ name: 'server', query: 'A,B', value: ['A', 'B'], isMulti: true });
    const item = panel('CPU $server');
    if (repeat === 'panels') {
      item.setState({ variableName: 'server' });
    }
    const row = new SceneGridRow({
      title: repeat === 'rows' ? 'Row $server' : 'Repeated panels',
      children: [item],
      $behaviors: repeat === 'rows' ? [new RowRepeaterBehavior({ variableName: 'server' })] : [],
    });
    const scene = new DashboardScene({
      $timeRange: new SceneTimeRange({}),
      $variables: new SceneVariableSet({ variables: [server] }),
      body: new DefaultGridLayoutManager({ grid: new SceneGridLayout({ children: [row] }) }),
      panelSearch: 'CPU B',
    });
    render(<scene.Component model={scene} />);
    expect(await screen.findByText('CPU B')).toBeVisible();
    expect(
      screen.getByRole('button', {
        name: `Collapse row with title ${repeat === 'rows' ? 'Row $server' : 'Repeated panels'}`,
      })
    ).toBeVisible();
    expect(screen.queryByText('CPU A')).not.toBeInTheDocument();
    if (repeat === 'rows') {
      expect(screen.queryByText('Row A')).not.toBeInTheDocument();
      expect(screen.getByText('Row B')).toBeVisible();
    }

    act(() => server.changeValueTo(['A']));
    expect(await screen.findByText('No panels matching')).toBeVisible();
    expect(screen.queryByText('CPU B')).not.toBeInTheDocument();
    expect(screen.queryByText(repeat === 'rows' ? 'Row B' : 'Repeated panels')).not.toBeInTheDocument();
  }
);

it.each(['horizontal', 'vertical'] as const)(
  'updates %s panel repeats while filtered, including collapsed rows and source-panel changes',
  async (layout) => {
    const server = new CustomVariable({ name: 'server', query: 'A,B,C', value: ['A'], isMulti: true });
    const search = new TextBoxVariable({ name: 'systemPanelFilterVar', value: 'CPU B' });
    const resize = new CustomVariable({ name: 'systemDynamicRowSizeVar', query: 'off,1,2,3,4', value: '2' });
    const item = new DashboardGridItem({
      body: new VizPanel({ key: `panel-${nextPanelId++}`, title: 'CPU $server', pluginId: 'text' }),
      variableName: 'server',
      repeatDirection: layout === 'horizontal' ? 'h' : 'v',
      width: 12,
      height: 8,
      x: 0,
      y: 1,
    });
    const body = new DefaultGridLayoutManager({
      grid: new SceneGridLayout({
        children: [new SceneGridRow({ title: 'Servers', y: 0, isCollapsed: true, children: [item] })],
      }),
    });
    const scene = new DashboardScene({
      $timeRange: new SceneTimeRange({}),
      $variables: new SceneVariableSet({ variables: [server, search, resize] }),
      body,
    });
    const buttonName = (action: string) => `${action} row with title Servers`;
    render(<scene.Component model={scene} />);
    expect(await screen.findByText('No panels matching')).toBeVisible();

    act(() => server.changeValueTo(['A', 'B']));
    expect(await screen.findByRole('button', { name: buttonName('Expand') })).toBeVisible();
    expect(item.state.body.isActive).toBe(false);
    expect(item.state.repeatedPanels?.[0].isActive).toBe(false);
    await userEvent.click(screen.getByRole('button', { name: buttonName('Expand') }));
    expect(await screen.findByText('CPU B')).toBeVisible();
    expect(screen.queryByText('CPU A')).not.toBeInTheDocument();

    act(() => server.changeValueTo(['B', 'C']));
    await waitFor(() => expect(screen.getAllByText('CPU B')).toHaveLength(1));
    expect(screen.queryByText('CPU C')).not.toBeInTheDocument();
    act(() => resize.changeValueTo('off'));
    expect(screen.getByRole('button', { name: buttonName('Collapse') })).toBeVisible();
    expect(screen.getByText('CPU B')).toBeVisible();

    act(() => search.setValue('CPU C'));
    expect(await screen.findByText('CPU C')).toBeVisible();
    expect(screen.queryByText('CPU B')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: buttonName('Collapse') }));
    act(() => server.changeValueTo(['A']));
    expect(await screen.findByText('No panels matching')).toBeVisible();
    expect(screen.queryByRole('button', { name: buttonName('Expand') })).not.toBeInTheDocument();

    act(() => server.changeValueTo(['C', 'A']));
    expect(await screen.findByRole('button', { name: buttonName('Expand') })).toBeVisible();
    expect(item.state.body.isActive).toBe(false);
    await userEvent.click(screen.getByRole('button', { name: buttonName('Expand') }));
    expect(await screen.findByText('CPU C')).toBeVisible();
    act(() => search.setValue(''));
    expect(await screen.findByText('CPU A')).toBeVisible();
    expect(screen.getAllByText('CPU C')).toHaveLength(1);
    expect(screen.getByRole('button', { name: buttonName('Collapse') })).toBeVisible();
  }
);

it('preserves classic rows and collapse state across search and resize variable changes', async () => {
  const search = new TextBoxVariable({ name: 'systemPanelFilterVar', value: '' });
  const resize = new CustomVariable({ name: 'systemDynamicRowSizeVar', query: 'off,1,2,4', value: '4' });
  const alpha = new SceneGridRow({
    title: 'Cluster Alpha',
    y: 0,
    children: [panel('CPU Alpha'), panel('Memory Alpha')],
  });
  const beta = new SceneGridRow({ title: 'Cluster Beta', y: 9, children: [panel('CPU Beta')] });
  const gamma = new SceneGridRow({ title: 'Cluster Gamma', y: 18, children: [panel('Memory Gamma')] });
  const empty = new SceneGridRow({ title: 'Empty', y: 27, children: [] });
  const scene = new DashboardScene({
    $timeRange: new SceneTimeRange({}),
    $variables: new SceneVariableSet({ variables: [search, resize] }),
    body: new DefaultGridLayoutManager({ grid: new SceneGridLayout({ children: [alpha, beta, gamma, empty] }) }),
  });
  render(<scene.Component model={scene} />);
  expect(await screen.findByText('Memory Gamma')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Collapse row with title Empty' })).toBeVisible();
  expect(scene.state.panelsPerRow).toBe(4);
  act(() => search.setValue('CPU'));
  expect(await screen.findByText('CPU Alpha')).toBeVisible();
  expect(screen.getByText('CPU Beta')).toBeVisible();
  expect(screen.queryByText('Cluster Gamma')).not.toBeInTheDocument();
  expect(screen.queryByText('Empty')).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Collapse row with title Cluster Alpha' }));
  act(() => resize.changeValueTo('off'));
  expect(await screen.findByText('CPU Beta')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Expand row with title Cluster Alpha' })).toBeVisible();
  expect(scene.state.panelsPerRow).toBeUndefined();
  act(() => search.setValue(''));
  expect(await screen.findByText('Memory Gamma')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Expand row with title Cluster Alpha' })).toBeVisible();
  act(() => resize.changeValueTo('1'));
  expect(scene.state.panelsPerRow).toBe(1);
  expect(screen.getByRole('button', { name: 'Collapse row with title Empty' })).toBeVisible();
  await userEvent.click(screen.getByRole('button', { name: 'Expand row with title Cluster Alpha' }));
  expect(await screen.findByText('Memory Alpha')).toBeVisible();
});
