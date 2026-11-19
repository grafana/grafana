import { render, screen, within } from 'test/test-utils';

import { presetsQuickEdit } from '@grafana/data';
import { getPanelPlugin } from '@grafana/data/test';
import { setPluginImportUtils } from '@grafana/runtime';
import { VizPanel } from '@grafana/scenes';
import { setTestFlags } from '@grafana/test-utils/unstable';

import { activateFullSceneTree } from '../../utils/test-utils';
import { DashboardScene } from '../DashboardScene';
import { AutoGridItem } from '../layout-auto-grid/AutoGridItem';
import { AutoGridLayout } from '../layout-auto-grid/AutoGridLayout';
import { AutoGridLayoutManager } from '../layout-auto-grid/AutoGridLayoutManager';

import { PanelEditActionsSingle } from './PanelEditActions';

const withQuickEdits = getPanelPlugin({ id: 'with-quick-edits' })
  .setPanelOptions((builder) =>
    builder
      .addBooleanSwitch({ path: 'legend.showLegend', name: 'Visibility', category: ['Legend'], defaultValue: true })
      .addTextInput({ path: 'legend.width', name: 'Width', category: ['Legend'] })
  )
  .setPresetsSupplier(() => [])
  .setQuickEdits(() => [
    {
      id: 'legend',
      title: 'Legend',
      icon: 'list-ul',
      optionIds: ['legend.showLegend', 'legend.width'],
      labels: { 'legend.width': 'Legend width' },
      summary: ({ options }) => ({ text: options.legend.showLegend ? 'Shown' : 'Hidden' }),
    },
    presetsQuickEdit(),
  ]);

// Declares a quick edit for an option the plugin never registers, so the panel offers none of it.
const withUnofferedQuickEdits = getPanelPlugin({ id: 'with-unoffered-quick-edits' }).setQuickEdits(() => [
  { id: 'shape', title: 'Shape', icon: 'circle', optionIds: ['shape'] },
]);

const withoutQuickEdits = getPanelPlugin({ id: 'without-quick-edits' });

const plugins = Object.fromEntries(
  [withQuickEdits, withUnofferedQuickEdits, withoutQuickEdits].map((plugin) => [plugin.meta.id, plugin])
);
setPluginImportUtils({
  importPanelPlugin: async (id) => plugins[id],
  getPanelPluginFromCache: (id) => plugins[id],
});

let deactivate: (() => void) | undefined;
afterEach(() => {
  deactivate?.();
  setTestFlags({});
});

function setup({ pluginId = 'with-quick-edits', flag = true }: { pluginId?: string; flag?: boolean } = {}) {
  setTestFlags({ 'grafana.panelQuickEdits': flag });
  const panel = new VizPanel({ key: `panel-${pluginId}`, pluginId, options: { legend: { showLegend: true } } });
  const dashboard = new DashboardScene({
    isEditing: true,
    body: new AutoGridLayoutManager({ layout: new AutoGridLayout({ children: [new AutoGridItem({ body: panel })] }) }),
  });
  deactivate = activateFullSceneTree(dashboard);
  return { panel, dashboard, ...render(<PanelEditActionsSingle panel={panel} />) };
}

it('leads the panel actions with a quick edits button when the plugin declares quick edits', () => {
  setup();

  const names = screen.getAllByRole('button').map((button) => button.getAttribute('aria-label'));
  expect(names.slice(0, 3)).toEqual(['Quick edits', 'Edit visualization', 'Panel settings']);
});

it.each([
  { desc: 'the flag is off', pluginId: 'with-quick-edits', flag: false },
  { desc: 'the plugin declares none', pluginId: 'without-quick-edits', flag: true },
  { desc: 'the panel offers none of their options', pluginId: 'with-unoffered-quick-edits', flag: true },
])('shows only the panel actions when $desc', ({ pluginId, flag }) => {
  setup({ pluginId, flag });

  expect(screen.getByRole('button', { name: 'Panel settings' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Quick edits' })).not.toBeInTheDocument();
});

it('swaps the actions for the quick edits, each named with its current value', async () => {
  const { user } = setup();

  await user.click(screen.getByRole('button', { name: 'Quick edits' }));

  expect(screen.getByRole('button', { name: 'Legend: Shown' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Panel settings' }).closest('[inert]')).not.toBeNull();
});

it('changes the option from the quick edit card as an undoable edit', async () => {
  const { user, panel, dashboard } = setup();
  await user.click(screen.getByRole('button', { name: 'Quick edits' }));

  await user.click(screen.getByRole('button', { name: 'Legend: Shown' }));
  const card = screen.getByRole('dialog', { name: 'Legend' });
  await user.click(within(card).getByRole('switch', { name: 'Visibility' }));

  expect(panel.state.options).toEqual({ legend: { showLegend: false } });
  expect(screen.getByRole('button', { name: 'Legend: Hidden' })).toBeInTheDocument();
  expect(dashboard.state.sidebar.state.undoStack.map((action) => action.description)).toEqual(['Legend: Visibility']);
});

it('closes the quick edit card when its button is pressed again', async () => {
  const { user } = setup();
  await user.click(screen.getByRole('button', { name: 'Quick edits' }));
  await user.click(screen.getByRole('button', { name: 'Legend: Shown' }));
  expect(screen.getByRole('dialog', { name: 'Legend' })).toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: 'Legend: Shown' }));

  expect(screen.queryByRole('dialog', { name: 'Legend' })).not.toBeInTheDocument();
});

it("names an option by the quick edit's label instead of its own name", async () => {
  const { user } = setup();
  await user.click(screen.getByRole('button', { name: 'Quick edits' }));

  await user.click(screen.getByRole('button', { name: 'Legend: Shown' }));
  const card = screen.getByRole('dialog', { name: 'Legend' });

  expect(within(card).getByRole('textbox', { name: 'Legend width' })).toBeInTheDocument();
  expect(within(card).queryByRole('textbox', { name: 'Width' })).not.toBeInTheDocument();
});

it('explains that there are no styles to show while the panel has none for its data', async () => {
  const { user } = setup();
  await user.click(screen.getByRole('button', { name: 'Quick edits' }));

  await user.click(screen.getByRole('button', { name: 'Style' }));

  const card = screen.getByRole('dialog', { name: 'Style' });
  expect(within(card).getByText("No styles to show for this panel's data")).toBeInTheDocument();
});
