import {
  formatRegistry,
  type InterpolationFormatParameter,
  type VariableCustomFormatterFn,
  type VariableValue,
} from '@grafana/scenes';
import { VariableFormatID } from '@grafana/schema';

import { isAdHoc } from '../variables/guard';

import { getVariableWrapper } from './LegacyVariableWrapper';

export function formatVariableValue(
  value: any,
  format?: InterpolationFormatParameter,
  variable?: any,
  text?: VariableValue
): string {
  // for some scopedVars there is no variable
  variable = variable || {};

  if (value === null || value === undefined) {
    return '';
  }

  if (isAdHoc(variable) && format !== VariableFormatID.QueryParam) {
    return '';
  }

  // if it's an object transform value to string
  if (!Array.isArray(value) && typeof value === 'object') {
    value = `${value}`;
  }

  if (typeof format === 'function') {
    // formatVariableValue takes the format, not the variable model, as its second argument, so it does not actually
    // match the legacyDefaultFormatter signature it is passed as.
    return format(value, variable, formatVariableValue as VariableCustomFormatterFn);
  }

  if (!format) {
    format = VariableFormatID.Glob;
  }

  // some formats have arguments that come after ':' character
  let args = format.split(':');
  if (args.length > 1) {
    format = args[0];
    args = args.slice(1);
  } else {
    args = [];
  }

  let formatItem = formatRegistry.getIfExists(format);

  if (!formatItem) {
    console.error(`Variable format ${format} not found. Using glob format as fallback.`);
    formatItem = formatRegistry.get(VariableFormatID.Glob);
  }

  const formatVariable = getVariableWrapper(variable, value, text ?? value);
  return formatItem.formatter(value, args, formatVariable);
}
