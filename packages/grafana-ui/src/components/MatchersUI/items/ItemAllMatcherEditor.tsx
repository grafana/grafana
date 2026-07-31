import { ItemMatcherID, itemMatchers } from '@grafana/data';
import { t } from '@grafana/i18n';

import { type ItemMatcherUIRegistryItem } from './types';

/** The allItems matcher takes no options, so it renders nothing. */
const ItemAllMatcherEditor = () => null;

export const getItemAllMatcherItem: () => ItemMatcherUIRegistryItem<undefined> = () => ({
  id: ItemMatcherID.allItems,
  component: ItemAllMatcherEditor,
  matcher: itemMatchers.get(ItemMatcherID.allItems),
  name: t('grafana-ui.item-matchers-ui.name-all-items', 'All items'),
  description: t('grafana-ui.item-matchers-ui.description-all-items', 'Set properties for every item of this kind'),
  optionsToLabel: () => '',
});
