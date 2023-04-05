import {
  DisplayProcessor,
  FieldType,
  formattedValueToString,
  getDisplayProcessor,
  getFieldDisplayValuesProxy,
  getFrameDisplayName,
  ScopedVars,
} from '@grafana/data';
import { VariableCustomFormatterFn } from '@grafana/scenes';

import { getFieldAccessor } from './fieldAccessorCache';
import { formatVariableValue } from './formatVariableValue';
import { getTemplateProxyForField } from './templateProxies';

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

/**
 * Macro support doing things like.
 * ${__data.name}
 * ${__data.fields[0].name}
 * ${__data.fields["Value"].labels.cluster}
 *
 * Requires rowIndex on dataContext
 */
export function dataMacro(
  match: string,
  fieldPath?: string,
  scopedVars?: ScopedVars,
  format?: string | VariableCustomFormatterFn
) {
  const dataContext = scopedVars?.__dataContext;
  if (!dataContext || !fieldPath) {
    return match;
  }

  const { frame, rowIndex } = dataContext.value;

  if (rowIndex === undefined || fieldPath === undefined) {
    return match;
  }

  const obj = {
    name: frame.name,
    refId: frame.refId,
    fields: getFieldDisplayValuesProxy({ frame, rowIndex }),
  };

  return getFieldAccessor(fieldPath)(obj) ?? '';
}

let fallbackDisplayProcessor: DisplayProcessor | undefined;

function getFallbackDisplayProcessor() {
  if (!fallbackDisplayProcessor) {
    fallbackDisplayProcessor = getDisplayProcessor();
  }

  return fallbackDisplayProcessor;
}

/**
 * ${__series} = frame display name
 */
export function seriesNameMacro(
  match: string,
  fieldPath?: string,
  scopedVars?: ScopedVars,
  format?: string | VariableCustomFormatterFn
) {
  const dataContext = scopedVars?.__dataContext;
  if (!dataContext) {
    return match;
  }

  if (fieldPath !== 'name') {
    return match;
  }

  const { frame, frameIndex } = dataContext.value;
  const value = getFrameDisplayName(frame, frameIndex);
  return formatVariableValue(value, format);
}

/**
 * Handles expressions like
 * ${__field.name}
 * ${__field.labels.cluster}
 */
export function fieldMacro(
  match: string,
  fieldPath?: string,
  scopedVars?: ScopedVars,
  format?: string | VariableCustomFormatterFn
) {
  const dataContext = scopedVars?.__dataContext;
  if (!dataContext) {
    return match;
  }

  if (fieldPath === undefined || fieldPath === '') {
    return match;
  }

  const { frame, field, data } = dataContext.value;
  const obj = getTemplateProxyForField(field, frame, data);

  return getFieldAccessor(fieldPath)(obj) ?? '';
}
