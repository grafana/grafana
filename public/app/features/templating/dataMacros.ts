import { FieldType, formattedValueToString, getDisplayProcessor, ScopedVars } from '@grafana/data';
import { VariableCustomFormatterFn } from '@grafana/scenes';

import { formatVariableValue } from './formatVariableValue';

const fallbackDisplayProcessor = getDisplayProcessor();

export function valueMacro(
  variableName: string,
  scopedVars?: ScopedVars,
  fieldPath?: string,
  format?: string | VariableCustomFormatterFn
) {
  const value = getValueForValueMacro(scopedVars, fieldPath);
  return formatVariableValue(value, format);
}

function getValueForValueMacro(scopedVars?: ScopedVars, fieldPath?: string) {
  const dataContext = scopedVars?.__dataContext;
  if (!dataContext) {
    return '';
  }

  const { frame, valueIndex, field, calculatedValue } = dataContext.value;

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

  if (valueIndex === undefined) {
    return '';
  }

  if (fieldPath === 'time') {
    const timeField = frame.fields.find((f) => f.type === FieldType.time);
    return timeField ? timeField.values.get(valueIndex) : undefined;
  }

  const value = field.values.get(valueIndex);
  if (fieldPath === 'raw') {
    return value;
  }

  const displayProcessor = field.display ?? fallbackDisplayProcessor;
  const result = displayProcessor(value);

  switch (fieldPath) {
    case 'numeric':
      return result.numeric;
    case 'text':
    default:
      return formattedValueToString(result);
  }
}
