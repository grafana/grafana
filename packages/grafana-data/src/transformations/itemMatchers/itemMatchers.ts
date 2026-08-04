import { stringToJsRegex } from '../../text/string';
import { type PanelItem } from '../../types/itemOverrides';
import { type RegistryItemWithOptions } from '../../utils/Registry';

import { ItemMatcherID } from './ids';

/**
 * Predicate deciding whether an item override rule applies to a mark.
 *
 * The item-shaped analogue of `FieldMatcher`. Unlike a field matcher it takes no frame
 * context — a mark is already resolved from the data by its kind's `getItems`.
 *
 * @alpha
 */
export type ItemMatcher = (item: PanelItem) => boolean;

/**
 * Registry item describing one way of selecting marks.
 *
 * @alpha
 */
// TOptions appears both contravariantly (get) and covariantly (defaultOptions), so the registry
// element type has to be `any` for concrete matchers to be assignable. Same as FieldMatcherInfo.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface ItemMatcherInfo<TOptions = any> extends RegistryItemWithOptions<TOptions> {
  get: (options: TOptions) => ItemMatcher;
}

const byItemIdsMatcher: ItemMatcherInfo<string[]> = {
  id: ItemMatcherID.byItemIds,
  name: 'Items',
  description: 'Match a specific set of items by id',
  defaultOptions: [],

  get: (ids: string[]) => {
    const set = new Set(ids ?? []);
    return (item: PanelItem) => set.has(item.id);
  },

  getOptionsDisplayText: (ids: string[]) => {
    return `Items: ${(ids ?? []).join(', ')}`;
  },
};

const byItemRegexpMatcher: ItemMatcherInfo<string> = {
  id: ItemMatcherID.byItemRegexp,
  name: 'Items matching regex',
  description: 'Match items whose label matches a regular expression',
  defaultOptions: '/.*/',

  get: (pattern: string) => {
    const regex = patternToRegex(pattern);
    // An item's label is what the user sees in the matcher UI, so match against it and
    // fall back to the id when the kind does not supply one.
    return (item: PanelItem) => !!regex && regex.test(item.label ?? item.id);
  },

  getOptionsDisplayText: (pattern: string) => {
    return `Items matching: ${pattern}`;
  },
};

const allItemsMatcher: ItemMatcherInfo = {
  id: ItemMatcherID.allItems,
  name: 'All items',
  description: 'Match every item of this kind',

  get: () => {
    return () => true;
  },

  getOptionsDisplayText: () => {
    return 'All items';
  },
};

// Mirrors the byRegexp field matcher: an unparseable pattern matches nothing rather than throwing.
const patternToRegex = (pattern?: string): RegExp | undefined => {
  if (!pattern) {
    return undefined;
  }

  try {
    return stringToJsRegex(pattern);
  } catch (error) {
    console.error(error);
    return undefined;
  }
};

/**
 * Registry Initialization
 */
export function getItemMatchers(): ItemMatcherInfo[] {
  return [byItemIdsMatcher, byItemRegexpMatcher, allItemsMatcher];
}
