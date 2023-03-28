import { DisplayProcessor, FieldType, formattedValueToString, getDisplayProcessor, ScopedVars } from '@grafana/data';
import { VariableCustomFormatterFn } from '@grafana/scenes';

import { formatVariableValue } from './formatVariableValue';

/**
 * ${__value.raw/nummeric/text/time} macro
 */
export function valueMacro(
  match: string,
  fieldPath?: string,
  scopedVars?: ScopedVars,
  format?: string | VariableCustomFormatterFn
) {
  const value = getValueForValueMacro(match, fieldPath, scopedVars);
  return formatVariableValue(value, format);
}

function getValueForValueMacro(match: string, fieldPath?: string, scopedVars?: ScopedVars) {
  const dataContext = scopedVars?.__dataContext;
  if (!dataContext) {
    return match;
  }

  const { frame, rowIndex, field, calculatedValue } = dataContext.value;

  if (calculatedValue) {
    switch (fieldPath) {
      case 'numeric':
        return calculatedValue.numeric.toString();
      case 'raw':
        return calculatedValue.numeric;
      case 'time':
        return '';
      case 'text':
      default:
        return formattedValueToString(calculatedValue);
    }
  }

  if (rowIndex === undefined) {
    return match;
  }

  if (fieldPath === 'time') {
    const timeField = frame.fields.find((f) => f.type === FieldType.time);
    return timeField ? timeField.values.get(rowIndex) : undefined;
  }

  const value = field.values.get(rowIndex);
  if (fieldPath === 'raw') {
    return value;
  }

  const displayProcessor = field.display ?? getFallbackDisplayProcessor();
  const result = displayProcessor(value);

  switch (fieldPath) {
    case 'numeric':
      return result.numeric;
    case 'text':
      return result.text;
    default:
      return formattedValueToString(result);
  }
}

let fallbackDisplayProcessor: DisplayProcessor | undefined;

function getFallbackDisplayProcessor() {
  if (!fallbackDisplayProcessor) {
    fallbackDisplayProcessor = getDisplayProcessor();
  }

  return fallbackDisplayProcessor;
}
