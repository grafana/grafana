export type TabId = 'viz' | 'style' | 'data' | 'rules';

// Category titles that route to the Data tab.
const DATA_TITLES = new Set(['Standard options', 'Axis', 'Null values', 'Time zone']);

// Category titles that route to the Rules tab.
const RULES_TITLES = new Set(['Thresholds', 'Value mappings', 'Data links']);

export function getCategoryTab(title: string): TabId {
  if (DATA_TITLES.has(title)) {
    return 'data';
  }
  if (RULES_TITLES.has(title)) {
    return 'rules';
  }
  return 'style';
}

// Items hidden in Basic mode, keyed as "CategoryTitle/itemId".
export const ADVANCED_ITEMS = new Set([
  'Axis/softMin',
  'Axis/softMax',
  'Axis/scaleDistribution',
  'Standard options/noValue',
  'Standard options/fieldMinMax',
  'Graph styles/connectNullValues',
  'Graph styles/showPoints',
  'Graph styles/barAlignment',
  'Legend/legendWidth',
  'Legend/sortBy',
  'Legend/sortDesc',
  'Tooltip/maxHeight',
  'Tooltip/maxWidth',
]);
