import { VariableOption } from 'app/features/templating/types';

export const alignCurrentWithMulti = (current: VariableOption, value: boolean): VariableOption => {
  if (!current) {
    return current;
  }

  if (value && !Array.isArray(current.value)) {
    return {
      ...current,
      value: convertToMulti(current.value),
      text: convertToMulti(current.text),
    };
  }

  if (!value && Array.isArray(current.value)) {
    return {
      ...current,
      value: convertToSingle(current.value),
      text: convertToSingle(current.text),
    };
  }

  return current;
};

const convertToSingle = (value: string | string[]): string => {
  if (!Array.isArray(value)) {
    return value;
  }

  if (value.length > 0) {
    return value[0];
  }

  return '';
};

const convertToMulti = (value: string | string[]): string[] => {
  if (Array.isArray(value)) {
    return value;
  }
  return [value];
};
