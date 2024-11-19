import logfmt from 'logfmt';

import { ScopedVars } from '../types/ScopedVars';
import { DataLinkTransformationConfig, SupportedTransformationType } from '../types/dataLink';

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
export const builtInVariables = [
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
  // These are only applicable in dashboards so should not affect this for Explore
  // '__dashboard',
  //'__name',
];
