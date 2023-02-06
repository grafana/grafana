import logfmt from 'logfmt';

import { ScopedVars, Transformation } from '@grafana/data';
import { safeStringifyValue } from 'app/core/utils/explore';

export const getTransformationVars = (
  transformation: Transformation,
  fieldValue: string,
  fieldName: string
): ScopedVars => {
  let transformationScopedVars: ScopedVars = {};
  if (transformation.type === 'regex' && transformation.expression) {
    const regexp = new RegExp(transformation.expression);
    const matches = fieldValue.match(regexp);
    if (matches && matches?.length > 0) {
      transformationScopedVars[transformation.variable || fieldName] = {
        value: matches[1] || matches[0], // not global - return capture group if found, else full match
      };
    }
  } else if (transformation.type === 'logfmt') {
    const logFmtVal = logfmt.parse(fieldValue) as { [key: string]: string | boolean | null };
    let scopeVarFromLogFmt: ScopedVars = {};
    Object.keys(logFmtVal).forEach((key) => {
      const logFmtValueString =
        typeof logFmtVal[key] === 'string' ? logFmtVal[key] : safeStringifyValue(logFmtVal[key]);
      scopeVarFromLogFmt[key] = { value: logFmtValueString };
    });
    transformationScopedVars = { ...transformationScopedVars, ...scopeVarFromLogFmt };
  }
  return transformationScopedVars;
};
