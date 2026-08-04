// Load the builtin item matchers
import { Registry } from '../utils/Registry';

import { getItemMatchers, type ItemMatcherInfo } from './itemMatchers/itemMatchers';

/**
 * Registry that contains all of the built in item matchers.
 *
 * The item-shaped counterpart of {@link fieldMatchers}: these select marks (rows) rather
 * than fields, for visualizations whose marks are rows.
 *
 * @alpha
 */
export const itemMatchers = new Registry<ItemMatcherInfo>(() => {
  return getItemMatchers();
});
