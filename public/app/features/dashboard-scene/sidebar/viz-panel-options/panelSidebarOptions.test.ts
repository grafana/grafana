import {
  type PanelPlugin,
  PanelOptionsEditorBuilder,
  standardEditorsRegistry,
  standardFieldConfigEditorRegistry,
} from '@grafana/data';
import { getAllOptionEditors, getAllStandardFieldConfigs } from 'app/core/components/OptionsUI/registry';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';
import { plugin as statPlugin } from 'app/plugins/panel/stat/module';
import { plugin as tablePlugin } from 'app/plugins/panel/table/module';
import { plugin as timeseriesPlugin } from 'app/plugins/panel/timeseries/module';

import {
  filterOptionsPaneCategories,
  getOptionsPaneItemId,
  getPanelSidebarOptionIds,
  PANEL_SIDEBAR_OPTIONS,
} from './panelSidebarOptions';

standardEditorsRegistry.setInit(getAllOptionEditors);
standardFieldConfigEditorRegistry.setInit(getAllStandardFieldConfigs);

function category(id: string, itemIds: string[], children: OptionsPaneCategoryDescriptor[] = []) {
  const descriptor = new OptionsPaneCategoryDescriptor({ id, title: id });
  for (const itemId of itemIds) {
    descriptor.addItem(new OptionsPaneItemDescriptor({ id: itemId, title: itemId, render: jest.fn() }));
  }
  children.forEach((child) => descriptor.addCategory(child));
  return descriptor;
}

function ids(categories: OptionsPaneCategoryDescriptor[]): unknown[] {
  return categories.map((c) => ({
    id: c.props.id,
    items: c.items.map((i) => i.props.id),
    ...(c.categories.length > 0 && { categories: ids(c.categories) }),
  }));
}

/** Every item id the panel editor's options pane can show for a plugin, ignoring showIf */
function getRegisteredItemIds(plugin: PanelPlugin): Set<string> {
  const builder = new PanelOptionsEditorBuilder();
  plugin.getPanelOptionsSupplier()(builder, { data: [] });
  const optionIds = builder.getItems().map((item) => item.id);
  const fieldConfigIds = plugin.fieldConfigRegistry
    .list()
    .map((item) => `${item.isCustom ? 'custom.' : ''}${item.path}`);

  return new Set([...optionIds, ...fieldConfigIds]);
}

describe('getOptionsPaneItemId', () => {
  it.each([
    ['options.legend.showLegend', 'legend.showLegend'],
    ['fieldConfig.defaults.unit', 'unit'],
    ['fieldConfig.defaults.custom.footer.reducers', 'custom.footer.reducers'],
  ])('maps %s to %s', (path, id) => {
    expect(getOptionsPaneItemId(path)).toBe(id);
  });

  it('rejects paths outside options and field config defaults', () => {
    expect(() => getOptionsPaneItemId('fieldConfig.overrides')).toThrow();
  });
});

describe('getPanelSidebarOptionIds', () => {
  it('returns undefined for visualizations without an entry', () => {
    expect(getPanelSidebarOptionIds('gauge')).toBeUndefined();
  });

  it.each([
    ['timeseries', timeseriesPlugin],
    ['stat', statPlugin],
    ['table', tablePlugin],
  ])('only lists options that exist in the %s option registry', (pluginId, plugin) => {
    const registered = getRegisteredItemIds(plugin);
    const missing = [...getPanelSidebarOptionIds(pluginId)!].filter((id) => !registered.has(id));

    expect(missing).toEqual([]);
  });

  it('has an entry for exactly the supported visualizations', () => {
    expect(Object.keys(PANEL_SIDEBAR_OPTIONS)).toEqual(['timeseries', 'stat', 'table']);
  });
});

describe('filterOptionsPaneCategories', () => {
  it('keeps only listed items, in their original category and item order', () => {
    const categories = [
      category('Tooltip', ['tooltip.mode', 'tooltip.hideZeros', 'tooltip.sort']),
      category('Legend', ['legend.showLegend', 'legend.width']),
    ];

    const result = filterOptionsPaneCategories(
      categories,
      new Set(['legend.showLegend', 'tooltip.sort', 'tooltip.mode'])
    );

    expect(ids(result)).toEqual([
      { id: 'Tooltip', items: ['tooltip.mode', 'tooltip.sort'] },
      { id: 'Legend', items: ['legend.showLegend'] },
    ]);
  });

  it('drops categories without listed items, including nested ones', () => {
    const categories = [
      category('Axis', ['custom.axisPlacement']),
      category('Table', ['showHeader'], [category('Nested', ['custom.width']), category('Kept', ['custom.align'])]),
    ];

    const result = filterOptionsPaneCategories(categories, new Set(['showHeader', 'custom.align']));

    expect(ids(result)).toEqual([
      { id: 'Table', items: ['showHeader'], categories: [{ id: 'Kept', items: ['custom.align'] }] },
    ]);
  });
});
