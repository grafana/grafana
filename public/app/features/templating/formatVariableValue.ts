import { formatRegistry, FormatRegistryID } from '@grafana/scenes';

import { isAdHoc } from '../variables/guard';

import { getVariableWrapper } from './LegacyVariableWrapper';

export function formatVariableValue(value: any, format?: any, variable?: any, text?: string): string {
  // for some scopedVars there is no variable
  variable = variable || {};

  if (value === null || value === undefined) {
    return '';
  }

  if (isAdHoc(variable) && format !== FormatRegistryID.queryParam) {
    return '';
  }

  // if it's an object transform value to string
  if (!Array.isArray(value) && typeof value === 'object') {
    value = `${value}`;
  }

  if (typeof format === 'function') {
    return format(value, variable, formatVariableValue);
  }

  if (!format) {
    format = FormatRegistryID.glob;
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
    formatItem = formatRegistry.get(FormatRegistryID.glob);
  }

  const formatVariable = getVariableWrapper(variable, value, text ?? value);
  return formatItem.formatter(value, args, formatVariable);
}
