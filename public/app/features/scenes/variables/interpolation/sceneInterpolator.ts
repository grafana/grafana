import { ScopedVars } from '@grafana/data';
import { VariableModel, VariableType } from '@grafana/schema';
import { variableRegex } from 'app/features/variables/utils';

import { EmptyVariableSet, sceneGraph } from '../../core/sceneGraph';
import { SceneObject } from '../../core/types';
import { VariableValue } from '../types';

import { getSceneVariableForScopedVar } from './ScopedVarsVariable';
import { formatRegistry, FormatRegistryID, FormatVariable } from './formatRegistry';

export type CustomFormatterFn = (
  value: unknown,
  legacyVariableModel: VariableModel,
  legacyDefaultFormatter?: CustomFormatterFn
) => string;

/**
 * This function will try to parse and replace any variable expression found in the target string. The sceneObject will be used as the source of variables. It will
 * use the scene graph and walk up the parent tree until it finds the closest variable.
 *
 * ScopedVars should not really be needed much in the new scene architecture as they can be added to the local scene node instead of passed in interpolate function.
 * It is supported here for backward compatibility and some edge cases where adding scoped vars to local scene node is not practical.
 */
export function sceneInterpolator(
  sceneObject: SceneObject,
  target: string | undefined | null,
  scopedVars?: ScopedVars,
  format?: string | CustomFormatterFn
): string {
  if (!target) {
    return target ?? '';
  }

  // Skip any interpolation if there are no variables in the scene object graph
  if (sceneGraph.getVariables(sceneObject) === EmptyVariableSet) {
    return target;
  }

  variableRegex.lastIndex = 0;

  return target.replace(variableRegex, (match, var1, var2, fmt2, var3, fieldPath, fmt3) => {
    const variableName = var1 || var2 || var3;
    const fmt = fmt2 || fmt3 || format;
    let variable: FormatVariable | undefined | null;

    if (scopedVars && scopedVars[variableName]) {
      variable = getSceneVariableForScopedVar(variableName, scopedVars[variableName]);
    } else {
      variable = lookupSceneVariable(variableName, sceneObject);
    }

    if (!variable) {
      return match;
    }

    return formatValue(variable, variable.getValue(fieldPath), fmt);
  });
}

function lookupSceneVariable(name: string, sceneObject: SceneObject): FormatVariable | null | undefined {
  const variables = sceneObject.state.$variables;
  if (!variables) {
    if (sceneObject.parent) {
      return lookupSceneVariable(name, sceneObject.parent);
    } else {
      return null;
    }
  }

  const found = variables.getByName(name);
  if (found) {
    return found;
  } else if (sceneObject.parent) {
    return lookupSceneVariable(name, sceneObject.parent);
  }

  return null;
}

function formatValue(
  variable: FormatVariable,
  value: VariableValue | undefined | null,
  formatNameOrFn: string | CustomFormatterFn
): string {
  if (value === null || value === undefined) {
    return '';
  }

  // if (isAdHoc(variable) && format !== FormatRegistryID.queryParam) {
  //   return '';
  // }

  // if it's an object transform value to string
  if (!Array.isArray(value) && typeof value === 'object') {
    value = `${value}`;
  }

  if (typeof formatNameOrFn === 'function') {
    return formatNameOrFn(value, {
      name: variable.state.name,
      type: variable.state.type as VariableType,
    });
  }

  let args: string[] = [];

  if (!formatNameOrFn) {
    formatNameOrFn = FormatRegistryID.glob;
  } else {
    // some formats have arguments that come after ':' character
    args = formatNameOrFn.split(':');
    if (args.length > 1) {
      formatNameOrFn = args[0];
      args = args.slice(1);
    } else {
      args = [];
    }
  }

  let formatter = formatRegistry.getIfExists(formatNameOrFn);

  if (!formatter) {
    console.error(`Variable format ${formatNameOrFn} not found. Using glob format as fallback.`);
    formatter = formatRegistry.get(FormatRegistryID.glob);
  }

  return formatter.formatter(value, args, variable);
}
