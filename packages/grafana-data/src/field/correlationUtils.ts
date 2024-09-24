import { uniqBy } from 'lodash';
import logfmt from 'logfmt';

import { ScopedVars } from '../types/ScopedVars';
import { DataLinkTransformationConfig, SupportedTransformationType, VariableInterpolation } from '../types/dataLink';
import { InterpolateFunction } from '../types/panel';

export const safeStringifyValue = (value: unknown, space?: number) => {
  if (value === undefined || value === null) {
    return '';
  }

  try {
    return JSON.stringify(value, null, space);
  } catch (error) {
    console.error(error);
  }

  return '';
};

export const getTransformationVars = (
  transformation: DataLinkTransformationConfig,
  fieldValue: string,
  fieldName: string
): ScopedVars => {
  let transformationScopedVars: ScopedVars = {};
  let transformVal: { [key: string]: string | boolean | null | undefined } = {};
  if (transformation.type === SupportedTransformationType.Regex && transformation.expression) {
    const regexp = new RegExp(transformation.expression, 'gi');
    const stringFieldVal = typeof fieldValue === 'string' ? fieldValue : safeStringifyValue(fieldValue);

    const matches = stringFieldVal.matchAll(regexp);
    for (const match of matches) {
      if (match.groups) {
        transformVal = match.groups;
      } else {
        transformVal[transformation.mapValue || fieldName] = match[1] || match[0];
      }
    }
  } else if (transformation.type === SupportedTransformationType.Logfmt) {
    transformVal = logfmt.parse(fieldValue);
  }

  Object.keys(transformVal).forEach((key) => {
    const transformValString =
      typeof transformVal[key] === 'string' ? transformVal[key] : safeStringifyValue(transformVal[key]);
    transformationScopedVars[key] = { value: transformValString };
  });

  return transformationScopedVars;
};

// See https://grafana.com/docs/grafana/latest/dashboards/variables/add-template-variables/#global-variables
export const builtInVariablesGlobal = [
  '__from',
  '__to',
  '__interval',
  '__interval_ms',
  '__org',
  '__user',
  '__range',
  '__rate_interval',
  '__timeFilter',
  'timeFilter',
];

// These are only applicable in dashboards so should not affect Explore
const builtInVariablesDashboards = ['__dashboard', '__name'];

export const builtInVariables = [...builtInVariablesGlobal, ...builtInVariablesDashboards];

/**
 * Use variable map from templateSrv to determine if all variables have values
 * @param query
 * @param scopedVars
 */
export function getVariableUsageInfo(
  query: object,
  scopedVars: ScopedVars,
  replaceFn: InterpolateFunction
): { variables: VariableInterpolation[]; allVariablesDefined: boolean } {
  let variables: VariableInterpolation[] = [];
  // This adds info to the variables array while interpolating
  replaceFn(getStringsFromObject(query), scopedVars, undefined, variables);
  variables = uniqBy(variables, 'variableName');
  return {
    variables: variables,
    allVariablesDefined: variables
      // We filter out builtin variables as they should be always defined but sometimes only later, like
      // __range_interval which is defined in prometheus at query time.
      .filter((v) => !builtInVariables.includes(v.variableName))
      .every((variable) => variable.found),
  };
}

// Recursively get all strings from an object into a simple list with space as separator.
function getStringsFromObject(obj: Object): string {
  let acc = '';
  let k: keyof typeof obj;

  for (k in obj) {
    if (typeof obj[k] === 'string') {
      acc += ' ' + obj[k];
    } else if (typeof obj[k] === 'object') {
      acc += ' ' + getStringsFromObject(obj[k]);
    }
  }
  return acc;
}
