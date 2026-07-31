import { useMemo } from 'react';

import { Registry, type SelectableValue } from '@grafana/data';

import { getItemAllMatcherItem } from './ItemAllMatcherEditor';
import { getItemIdsMatcherItem } from './ItemIdsMatcherEditor';
import { getItemRegexpMatcherItem } from './ItemRegexpMatcherEditor';
import { type ItemMatcherUIRegistryItem } from './types';

/**
 * The editors available for selecting marks in an item override rule.
 *
 * @alpha
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- heterogeneous option types, as fieldMatchersUI
export const itemMatchersUI = new Registry<ItemMatcherUIRegistryItem<any>>(() => [
  getItemIdsMatcherItem(),
  getItemRegexpMatcherItem(),
  getItemAllMatcherItem(),
]);

/**
 * @alpha
 */
export function useItemMatchersOptions(): Array<SelectableValue<string>> {
  return useMemo(() => itemMatchersUI.selectOptions().options, []);
}
