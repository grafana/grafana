import { type OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';

const sharedOptions = [
  'fieldConfig.defaults.thresholds',
  'fieldConfig.defaults.unit',
  'fieldConfig.defaults.color',
  'fieldConfig.defaults.mappings',
  'fieldConfig.defaults.min',
  'fieldConfig.defaults.max',
  'fieldConfig.defaults.decimals',
  'fieldConfig.defaults.noValue',
  'fieldConfig.defaults.displayName',
  'fieldConfig.defaults.links',
];

/**
 * Visualization options shown in the dashboard edit pane for a selected panel, by panel plugin id.
 * Categories, order and editors come from the panel editor; this only picks which options to show.
 * Visualizations without an entry get no options in the edit pane, except the new text panel, which
 * gets its in-panel editor (see usePanelSidebarVizOptions).
 */
export const PANEL_SIDEBAR_OPTIONS: Record<string, string[]> = {
  timeseries: [
    ...sharedOptions,
    'options.legend.calcs',
    'options.legend.placement',
    'options.legend.displayMode',
    'options.legend.showLegend',
    'options.tooltip.mode',
    'fieldConfig.defaults.custom.thresholdsStyle',
    'options.tooltip.sort',
    'fieldConfig.defaults.custom.scaleDistribution',
  ],
  stat: [
    ...sharedOptions,
    'options.reduceOptions.calcs',
    'options.reduceOptions.fields',
    'options.text.valueSize',
    'options.text.titleSize',
    'options.colorMode',
    'options.textMode',
    'options.orientation',
  ],
  table: [
    ...sharedOptions,
    'fieldConfig.defaults.custom.filterable',
    'fieldConfig.defaults.custom.footer.reducers',
    'options.enablePagination',
    'fieldConfig.defaults.custom.cellOptions',
    'fieldConfig.defaults.custom.align',
    'options.cellHeight',
    'options.showHeader',
  ],
};

const OPTIONS_PREFIX = 'options.';
const FIELD_CONFIG_PREFIX = 'fieldConfig.defaults.';

/**
 * Maps a panel model path to the item id the panel editor's options pane uses:
 * the option path for panel options, `custom.`-prefixed for custom field config.
 */
export function getOptionsPaneItemId(path: string): string {
  if (path.startsWith(OPTIONS_PREFIX)) {
    return path.slice(OPTIONS_PREFIX.length);
  }

  if (path.startsWith(FIELD_CONFIG_PREFIX)) {
    return path.slice(FIELD_CONFIG_PREFIX.length);
  }

  throw new Error(`Unsupported panel option path "${path}"`);
}

export function getPanelSidebarOptionIds(pluginId: string): Set<string> | undefined {
  const paths = PANEL_SIDEBAR_OPTIONS[pluginId];
  return paths ? new Set(paths.map(getOptionsPaneItemId)) : undefined;
}

/**
 * Keeps only the items with the given ids, dropping categories left empty. Mutates the passed categories.
 */
export function filterOptionsPaneCategories(
  categories: OptionsPaneCategoryDescriptor[],
  itemIds: Set<string>
): OptionsPaneCategoryDescriptor[] {
  return categories.filter((category) => filterCategory(category, itemIds));
}

function filterCategory(category: OptionsPaneCategoryDescriptor, itemIds: Set<string>): boolean {
  category.items = category.items.filter((item) => itemIds.has(item.props.id));
  category.categories = category.categories.filter((child) => filterCategory(child, itemIds));

  return category.items.length > 0 || category.categories.length > 0;
}
