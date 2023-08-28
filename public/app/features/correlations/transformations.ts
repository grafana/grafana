import logfmt from 'logfmt';

import { ScopedVars, DataLinkTransformationConfig, SupportedTransformationType } from '@grafana/data';
import { safeStringifyValue } from 'app/core/utils/explore';

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
