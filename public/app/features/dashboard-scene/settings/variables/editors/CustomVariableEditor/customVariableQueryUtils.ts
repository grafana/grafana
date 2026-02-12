import { isObject } from 'lodash';

import { shallowCompare } from '@grafana/data';
import {
  CustomVariable,
  VariableValueOption,
  VariableValueOptionProperties,
  VariableValueSingle,
} from '@grafana/scenes';

type JsonOption = Record<string, unknown>;

interface JsonQueryValidationResult {
  error?: Error;
  parsedOptions?: JsonOption[];
}

export const parseAndValidateJsonQuery = (query: string): JsonQueryValidationResult => {
  if (!query) {
    return { parsedOptions: [] };
  }

  try {
    const parsed = JSON.parse(query);

    if (!Array.isArray(parsed)) {
      throw new Error('Enter a valid JSON array of objects');
    }

    if (!parsed.length) {
      return { parsedOptions: [] };
    }

    const options: JsonOption[] = [];
    for (let idx = 0; idx < parsed.length; idx++) {
      const item = parsed[idx];
      if (!isJsonOption(item)) {
        throw new Error(`All items must be objects. The item at index ${idx} is not an object.`);
      }
      options.push(item);
    }

    let errorIndex = -1;
    const keys = Object.keys(options[0]);
    if (!keys.includes('value')) {
      throw new Error('Each object in the array must include at least a "value" property');
    }
    if (keys.includes('')) {
      throw new Error('Object property names cannot be empty strings');
    }

    errorIndex = options.findIndex((o) => !shallowCompare(keys, Object.keys(o)));
    if (errorIndex !== -1) {
      throw new Error(
        `All objects must have the same set of properties. The object at index ${errorIndex} does not match the expected properties`
      );
    }

    return { parsedOptions: options };
  } catch (error) {
    return {
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
};

export const validateJsonQuery = (query: string): Error | undefined => parseAndValidateJsonQuery(query).error;

export const transformCsvQueryToFormOptions = (variable: CustomVariable, query: string): VariableValueOption[] =>
  variable.transformCsvStringToOptions(query, false).map(({ label, value }) => ({
    value,
    label: value === label ? '' : label,
  }));

const escapeEntities = (text: VariableValueSingle) => String(text).trim().replaceAll(',', '\\,');

export const transformFormOptionsToCsvQuery = (options: VariableValueOption[]): string =>
  options
    .map((option) => {
      if (!option.label || option.label === option.value) {
        return escapeEntities(option.value);
      }
      return `${escapeEntities(option.label)} : ${escapeEntities(String(option.value))}`;
    })
    .join(', ');

const jsonOptionToVariableOption = (option: JsonOption): VariableValueOption => {
  const value: VariableValueSingle = normalizeVariableValue(option.value);
  const label = option.text === undefined ? String(value) : String(option.text);
  const properties: VariableValueOptionProperties = {};

  for (const [key, propertyValue] of Object.entries(option)) {
    properties[key] = String(propertyValue ?? '');
  }

  return {
    value,
    label,
    properties,
  };
};

export const buildCustomVariablePreviewOptions = ({
  variable,
  valuesFormat,
  query,
  parsedJsonOptions,
}: {
  variable: CustomVariable;
  valuesFormat: 'csv' | 'json' | undefined;
  query: string;
  parsedJsonOptions?: JsonOption[];
}): VariableValueOption[] => {
  if (valuesFormat === 'json') {
    const jsonOptions = parsedJsonOptions ?? parseAndValidateJsonQuery(query).parsedOptions;
    return jsonOptions?.map(jsonOptionToVariableOption) ?? [];
  }

  return variable.transformCsvStringToOptions(query, false);
};

function isJsonOption(value: unknown): value is JsonOption {
  return isObject(value) && !Array.isArray(value);
}

function normalizeVariableValue(value: unknown): VariableValueSingle {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  return String(value ?? '');
}
