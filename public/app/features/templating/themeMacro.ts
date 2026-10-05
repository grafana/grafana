import { type ScopedVars } from '@grafana/data';
import { config } from '@grafana/runtime';
import { type FormatVariable, type SceneObject, type VariableCustomFormatterFn } from '@grafana/scenes';

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
  return formatVariableValue(getThemeValue(fieldPath) ?? match, format);
}

export class ThemeMacro implements FormatVariable {
  public state: { name: string; type: string };

  public constructor(
    name: string,
    _sceneObject: SceneObject,
    private _match: string
  ) {
    this.state = { name, type: 'theme_macro' };
  }

  public getValue(fieldPath?: string): string {
    return getThemeValue(fieldPath) ?? this._match;
  }
}

// Only leaf values: an object would render as [object Object] and a function as its source code.
function getThemeValue(fieldPath?: string): string | undefined {
  if (!fieldPath) {
    return undefined;
  }

  const value = getFieldAccessor(fieldPath)(config.theme2);

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return undefined;
}
