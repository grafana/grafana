import { render, screen, within } from 'test/test-utils';

import { presetsQuickEdit } from '@grafana/data';
import { getPanelPlugin } from '@grafana/data/test';
import { setPluginImportUtils } from '@grafana/runtime';
import { VizPanel } from '@grafana/scenes';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { getPortalContainer } from '@grafana/ui';
import { preloadOptionEditors } from 'app/core/components/OptionsUI/registry';

import { activateFullSceneTree } from '../../utils/test-utils';
import { DashboardScene } from '../DashboardScene';
import { LibraryPanelBehavior } from '../LibraryPanelBehavior';
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

// The editor leaves out the name of an option named like its category, whose heading the card doesn't show.
const withCategoryNamedOption = getPanelPlugin({ id: 'with-category-named-option' })
  .setPanelOptions((builder) =>
    builder.addBooleanSwitch({ path: 'legend.showLegend', name: 'Legend', category: ['Legend'], defaultValue: true })
  )
  .setQuickEdits(() => [{ id: 'display', title: 'Display', icon: 'eye', optionIds: ['legend.showLegend'] }]);

const plugins = Object.fromEntries(
  [withQuickEdits, withUnofferedQuickEdits, withoutQuickEdits, withCategoryNamedOption].map((plugin) => [
    plugin.meta.id,
    plugin,
  ])
);
setPluginImportUtils({
  importPanelPlugin: async (id) => plugins[id],
  getPanelPluginFromCache: (id) => plugins[id],
});

// The buttons load the option editors' code as they mount and hold cards back until it has loaded.
beforeAll(() => preloadOptionEditors());

let deactivate: (() => void) | undefined;
afterEach(() => {
  deactivate?.();
  setTestFlags({});
});

// Whether a panel shows its quick edits outlives its popover and is keyed by the panel's key, so each test gets its own.
let panelCount = 0;

function setup({
  pluginId = 'with-quick-edits',
  flag = true,
  libraryPanel = false,
}: { pluginId?: string; flag?: boolean; libraryPanel?: boolean } = {}) {
  setTestFlags({ 'grafana.panelQuickEdits': flag });
  const panel = new VizPanel({
    key: `panel-${++panelCount}`,
    pluginId,
    options: { legend: { showLegend: true } },
    $behaviors: libraryPanel ? [new LibraryPanelBehavior({ uid: 'lib-1', name: 'Library panel', isLoaded: true })] : [],
  });
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
  // Its changes are saved only from the panel editor.
  { desc: 'the panel is a library panel', pluginId: 'with-quick-edits', flag: true, libraryPanel: true },
])('shows only the panel actions when $desc', ({ pluginId, flag, libraryPanel }) => {
  setup({ pluginId, flag, libraryPanel });

  expect(screen.getByRole('button', { name: 'Panel settings' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Quick edits' })).not.toBeInTheDocument();
});

it('builds the quick edits from the full editor only once they are shown', async () => {
  const buildOptions = jest.spyOn(withQuickEdits, 'getPanelOptionsSupplier');
  const { user } = setup();
  expect(buildOptions).not.toHaveBeenCalled();

  await user.click(screen.getByRole('button', { name: 'Quick edits' }));

  expect(buildOptions).toHaveBeenCalled();
  buildOptions.mockRestore();
});

it('explains that there are no quick edits once shown, when the panel offers none of their options', async () => {
  const { user } = setup({ pluginId: 'with-unoffered-quick-edits' });

  await user.click(screen.getByRole('button', { name: 'Quick edits' }));

  expect(screen.getByText("No quick edits for this panel's settings")).toBeInTheDocument();
});

it('swaps the actions for the quick edits, each named with its current value', async () => {
  const { user } = setup();

  await user.click(screen.getByRole('button', { name: 'Quick edits' }));

  expect(screen.getByRole('button', { name: 'Legend: Shown' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Panel settings' }).closest('[inert]')).not.toBeNull();
});

it('keeps focus on the bar as the quick edits swap in and out', async () => {
  const { user } = setup();

  await user.click(screen.getByRole('button', { name: 'Quick edits' }));
  expect(screen.getByRole('button', { name: 'Back to panel actions' })).toHaveFocus();

  await user.click(screen.getByRole('button', { name: 'Back to panel actions' }));
  expect(screen.getByRole('button', { name: 'Quick edits' })).toHaveFocus();
});

it('focuses the quick edit card as it opens, and Escape closes it and goes back to the panel actions', async () => {
  const { user } = setup();
  await user.click(screen.getByRole('button', { name: 'Quick edits' }));

  await user.click(screen.getByRole('button', { name: 'Legend: Shown' }));
  expect(screen.getByRole('dialog', { name: 'Legend' })).toHaveFocus();

  await user.keyboard('{Escape}');
  expect(screen.queryByRole('dialog', { name: 'Legend' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Quick edits' })).toHaveFocus();
  expect(screen.getByRole('button', { name: 'Panel settings' }).closest('[inert]')).toBeNull();
});

it('moves Tab from the open quick edit card into its controls', async () => {
  const { user } = setup();
  await user.click(screen.getByRole('button', { name: 'Quick edits' }));
  await user.click(screen.getByRole('button', { name: 'Legend: Shown' }));

  await user.tab();

  expect(within(screen.getByRole('dialog', { name: 'Legend' })).getByRole('button', { name: 'Close' })).toHaveFocus();
});

it('goes back to the panel actions and focuses the bolt when the card is closed with its close button', async () => {
  const { user } = setup();
  await user.click(screen.getByRole('button', { name: 'Quick edits' }));
  await user.click(screen.getByRole('button', { name: 'Legend: Shown' }));

  await user.click(within(screen.getByRole('dialog', { name: 'Legend' })).getByRole('button', { name: 'Close' }));

  expect(screen.queryByRole('dialog', { name: 'Legend' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Quick edits' })).toHaveFocus();
  expect(screen.getByRole('button', { name: 'Panel settings' }).closest('[inert]')).toBeNull();
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
  // The pointer is on the bar, so it keeps the quick edits.
  expect(screen.getByRole('button', { name: 'Legend: Shown' }).closest('[inert]')).toBeNull();
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

it("names an option that shares its category's name, as the card's heading is the quick edit's", async () => {
  const { user } = setup({ pluginId: 'with-category-named-option' });
  await user.click(screen.getByRole('button', { name: 'Quick edits' }));

  await user.click(screen.getByRole('button', { name: 'Display' }));

  const card = screen.getByRole('dialog', { name: 'Display' });
  expect(within(card).getByRole('switch', { name: 'Legend' })).toBeInTheDocument();
});

it("closes the quick edit card on a press in another overlay, such as another panel's actions", async () => {
  const { user } = setup();
  await user.click(screen.getByRole('button', { name: 'Quick edits' }));
  await user.click(screen.getByRole('button', { name: 'Legend: Shown' }));
  const overlay = document.createElement('button');
  getPortalContainer().appendChild(overlay);

  await user.click(overlay);

  expect(screen.queryByRole('dialog', { name: 'Legend' })).not.toBeInTheDocument();
  overlay.remove();
});
