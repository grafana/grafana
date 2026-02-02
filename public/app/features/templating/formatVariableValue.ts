// import { formatRegistry } from '@grafana/scenes';
import { VariableFormatID } from '@grafana/schema';

import { getFeatureStatus } from '../dashboard/services/featureFlagSrv';
import { ALL_VARIABLE_VALUE, NONE_VARIABLE_TEXT } from '../variables/constants';
import { isAdHoc } from '../variables/guard';

import { getVariableWrapper } from './LegacyVariableWrapper';
import { formatRegistry } from './bmcFormatRegistry';

// BMC code - inline change
// to update function definition, emptyValue & customAllValue parameters
export function formatVariableValue(
  value: any,
  format?: any,
  variable?: any,
  text?: string,
  emptyValue?: string,
  customAllValue?: boolean
): string {
  // for some scopedVars there is no variable
  variable = variable || {};

  if (value === null || value === undefined) {
    return '';
  }
  // BMC Code Change Start
  let discardForAll = variable.discardForAll;
  if (getFeatureStatus('bhd-ar-all-values-v2') && discardForAll === undefined) {
    discardForAll = false;
  } else if (getFeatureStatus('bhd-ar-all-values') && discardForAll === undefined) {
    discardForAll = true;
  }
  if (
    emptyValue &&
    (variable.current.value?.[0] === ALL_VARIABLE_VALUE || variable.current.value === ALL_VARIABLE_VALUE) &&
    customAllValue === true &&
    variable.includeAll &&
    discardForAll
  ) {
    return emptyValue;
  }

  if (
    value.length === 0 &&
    emptyValue &&
    (variable.current.text?.[0] === NONE_VARIABLE_TEXT || variable.current.text === NONE_VARIABLE_TEXT)
  ) {
    return emptyValue;
  }
  // BMC Code Change End

  if (isAdHoc(variable) && format !== VariableFormatID.QueryParam) {
    return '';
  }

  // if it's an object transform value to string
  if (!Array.isArray(value) && typeof value === 'object') {
    value = `${value}`;
  }

  // check the following conditions if valid
  if (typeof format === 'function') {
    return format(value, variable, formatVariableValue);
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

// BMC Change Start
export function containsSingleQuote(target: string, variableMatch: string, varMap: { [key: string]: number }) {
  const regex = new RegExp(`\\${variableMatch}`, 'g');
  const indices = [];
  let match;
  let matchedIndex: number;
  while ((match = regex.exec(target)) !== null) {
    indices.push(match.index);
  }
  if (varMap[variableMatch]) {
    matchedIndex = indices[varMap[variableMatch]];
    varMap[variableMatch]++;
  } else {
    matchedIndex = indices[0];
    varMap[variableMatch] = 1;
  }
  if (
    matchedIndex > 0 &&
    target.charAt(matchedIndex - 1) === "'" &&
    target.charAt(matchedIndex + variableMatch.length) === "'"
  ) {
    return true;
  }
  return false;
}
// BMC Change End
