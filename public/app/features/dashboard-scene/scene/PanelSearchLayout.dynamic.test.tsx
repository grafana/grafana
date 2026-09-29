import { act, screen, waitFor, within } from '@testing-library/react';
import { render, userEvent, testWithFeatureToggles } from 'test/test-utils';

import { getPanelPlugin } from '@grafana/data/test';
import { selectors } from '@grafana/e2e-selectors';
import { setPluginImportUtils, setPluginLinksHook } from '@grafana/runtime';
import { CustomVariable, SceneTimeRange, SceneVariableSet, TextBoxVariable, VizPanel } from '@grafana/scenes';

import { DashboardScene } from './DashboardScene';
import { AutoGridItem } from './layout-auto-grid/AutoGridItem';
import { AutoGridLayout } from './layout-auto-grid/AutoGridLayout';
import { AutoGridLayoutManager } from './layout-auto-grid/AutoGridLayoutManager';
import { RowItem } from './layout-rows/RowItem';
import { RowsLayoutManager } from './layout-rows/RowsLayoutManager';

setPluginLinksHook(() => ({ links: [], isLoading: false }));

setPluginImportUtils({
  importPanelPlugin: () =>
    Promise.resolve(getPanelPlugin({ id: 'text', skipDataQuery: true }, () => <div>Panel content</div>)),
  getPanelPluginFromCache: () => undefined,
});

testWithFeatureToggles({ enable: ['dashboardNewLayouts'] });

function setupRows({ nested = false, collapsed = false } = {}) {
  const item = new AutoGridItem({ body: new VizPanel({ title: 'Primary CPU', pluginId: 'text' }) });
  const row = new RowItem({
    title: 'Cluster Alpha',
    collapse: collapsed,
    layout: new AutoGridLayoutManager({ layout: new AutoGridLayout({ children: [item] }) }),
  });
  const emptyRow = new RowItem({
    title: 'Cluster Beta',
    layout: new AutoGridLayoutManager({
      layout: new AutoGridLayout({
        children: [new AutoGridItem({ body: new VizPanel({ title: 'Other CPU', pluginId: 'text' }) })],
      }),
    }),
  });
  const rows = new RowsLayoutManager({ rows: [row, emptyRow] });
  const scene = new DashboardScene({
    isEditing: false,
    $timeRange: new SceneTimeRange({}),
    $variables: new SceneVariableSet({ variables: [] }),
    body: nested ? new RowsLayoutManager({ rows: [new RowItem({ title: 'Outer', layout: rows })] }) : rows,
    panelSearch: 'Primary',
    panelsPerRow: 2,
  });
  render(<scene.Component model={scene} />);
  return { scene, row, item };
}

it.each([false, true])('preserves matching rows in the new rows layout (nested: %s)', async (nested) => {
  const { scene } = setupRows({ nested });
  expect(await screen.findByRole('button', { name: 'Collapse row Cluster Alpha' })).toBeVisible();
  expect(await screen.findByText('Primary CPU')).toBeVisible();
  expect(screen.queryByText('Cluster Beta')).not.toBeInTheDocument();
  if (nested) {
    expect(screen.getByRole('button', { name: 'Collapse row Outer' })).toBeVisible();
  }

  act(() => scene.setState({ panelSearch: 'nothing matches' }));
  expect(await screen.findByText('No panels matching')).toBeVisible();
  expect(screen.queryByText('Cluster Alpha')).not.toBeInTheDocument();
  expect(screen.queryByText('Outer')).not.toBeInTheDocument();
});

it('keeps new rows collapsed while identifying matches in their auto grid', async () => {
  const { item } = setupRows({ collapsed: true });
  const toggle = await screen.findByRole('button', { name: 'Expand row Cluster Alpha' });
  expect(toggle).toBeVisible();
  expect(item.state.body.isActive).toBe(false);

  await userEvent.click(toggle);
  expect(await screen.findByText('Primary CPU')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Collapse row Cluster Alpha' })).toHaveAttribute('aria-expanded', 'true');
});

it('collapses a parent row without losing matches or activating nested panels', async () => {
  const { item } = setupRows({ nested: true });
  const toggle = await screen.findByRole('button', { name: 'Collapse row Outer' });
  expect(await screen.findByText('Primary CPU')).toBeVisible();

  await userEvent.click(toggle);
  expect(screen.getByRole('button', { name: 'Expand row Outer' })).toBeVisible();
  expect(screen.queryByText('Primary CPU')).not.toBeInTheDocument();
  expect(item.state.body.isActive).toBe(false);

  await userEvent.click(screen.getByRole('button', { name: 'Expand row Outer' }));
  expect(await screen.findByText('Primary CPU')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Collapse row Cluster Alpha' })).toBeVisible();
});

it.each(['panels', 'rows'] as const)('filters repeated %s inside the new rows layout', async (repeat) => {
  const server = new CustomVariable({ name: 'server', query: 'A,B', value: ['A', 'B'], isMulti: true });
  const item = new AutoGridItem({
    body: new VizPanel({ title: 'CPU $server', pluginId: 'text' }),
    variableName: repeat === 'panels' ? 'server' : undefined,
  });
  const row = new RowItem({
    title: repeat === 'rows' ? 'Row $server' : 'Repeated panels',
    repeatByVariable: repeat === 'rows' ? 'server' : undefined,
    layout: new AutoGridLayoutManager({ layout: new AutoGridLayout({ children: [item] }) }),
  });
  const scene = new DashboardScene({
    isEditing: false,
    $timeRange: new SceneTimeRange({}),
    $variables: new SceneVariableSet({ variables: [server] }),
    body: new RowsLayoutManager({ rows: [row] }),
    panelSearch: 'CPU B',
  });
  render(<scene.Component model={scene} />);
  expect(await screen.findByText('CPU B')).toBeVisible();
  expect(
    screen.getByRole('button', { name: `Collapse row ${repeat === 'rows' ? 'Row B' : 'Repeated panels'}` })
  ).toBeVisible();
  expect(screen.queryByText('CPU A')).not.toBeInTheDocument();
  expect(screen.queryByText('Row A')).not.toBeInTheDocument();

  act(() => server.changeValueTo(['A']));
  expect(await screen.findByText('No panels matching')).toBeVisible();
  expect(screen.queryByText('CPU B')).not.toBeInTheDocument();
});

it('keeps the standard row controls and accessible content when filtering and resizing', async () => {
  const { scene } = setupRows();
  const matchingPanel = await screen.findByText('Primary CPU');
  const row = screen.getByTestId(selectors.components.DashboardRow.wrapper('Cluster Alpha'));
  const toggle = within(row).getByRole('button', { name: 'Collapse row Cluster Alpha' });
  expect(within(row).getByRole('button', { name: 'Copy link to row' })).toBeInTheDocument();
  expect(document.getElementById(toggle.getAttribute('aria-controls')!)).toContainElement(matchingPanel);

  await userEvent.click(toggle);
  expect(within(row).getByRole('button', { name: 'Expand row Cluster Alpha' })).toHaveAttribute(
    'aria-expanded',
    'false'
  );
  expect(within(row).getByRole('button', { name: 'Copy link to row' })).toBeInTheDocument();

  act(() => scene.setState({ panelSearch: '', panelsPerRow: 4 }));
  expect(await screen.findByText('Other CPU')).toBeVisible();
  await userEvent.click(within(row).getByRole('button', { name: 'Expand row Cluster Alpha' }));
  expect(await screen.findByText('Primary CPU')).toBeVisible();
  expect(within(row).getByRole('button', { name: 'Copy link to row' })).toBeInTheDocument();
});

it('updates auto-grid panel repeats while filtered, including collapsed rows and source-panel changes', async () => {
  const server = new CustomVariable({ name: 'server', query: 'A,B,C', value: ['A'], isMulti: true });
  const search = new TextBoxVariable({ name: 'systemPanelFilterVar', value: 'CPU B' });
  const resize = new CustomVariable({ name: 'systemDynamicRowSizeVar', query: 'off,1,2,3,4', value: '2' });
  const item = new AutoGridItem({
    body: new VizPanel({ title: 'CPU $server', pluginId: 'text' }),
    variableName: 'server',
  });
  const body = new RowsLayoutManager({
    rows: [
      new RowItem({
        title: 'Servers',
        collapse: true,
        layout: new AutoGridLayoutManager({ layout: new AutoGridLayout({ children: [item] }) }),
      }),
    ],
  });
  const scene = new DashboardScene({
    isEditing: false,
    $timeRange: new SceneTimeRange({}),
    $variables: new SceneVariableSet({ variables: [server, search, resize] }),
    body,
  });
  const buttonName = (action: string) => `${action} row Servers`;
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
});
