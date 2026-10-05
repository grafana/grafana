import { type ScopedVars } from '@grafana/data';
import { config } from '@grafana/runtime';
import { type VariableCustomFormatterFn } from '@grafana/scenes';

import { getFieldAccessor } from './fieldAccessorCache';
import { formatVariableValue } from './formatVariableValue';

/**
 * ${__theme.colors.text.primary} macro
 */
export function themeMacro(
  match: string,
  fieldPath?: string,
  scopedVars?: ScopedVars,
  format?: string | VariableCustomFormatterFn
) {
  const value = fieldPath ? getFieldAccessor(fieldPath)(config.theme2) : undefined;

  // Only leaf values: an object would render as [object Object] and a function as its source code.
  const isLeaf = typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';

  return formatVariableValue(isLeaf ? String(value) : match, format);
}
