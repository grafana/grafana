import { VariableWithMultiSupport, VariableOption } from 'app/features/templating/types';

export const alignCurrentWithMulti = <Model extends VariableWithMultiSupport>(
  variable: Model,
  value: boolean
): VariableOption => {
  const { current } = variable;

  if (value && !Array.isArray(current.value)) {
    return {
      ...current,
      value: convertToMulti(current.value),
    };
  }

  if (!value && Array.isArray(current.value)) {
    return {
      ...current,
      value: convertToMulti(current.value),
      text: convertToSingle(current.text),
    };
  }

  return current;
};

const convertToSingle = (value: string | string[]): string => {
  if (Array.isArray(value) && value.length > 0) {
    return value[0];
  }
  return value.toString();
};

const convertToMulti = (value: string | string[]): string[] => {
  if (Array.isArray(value)) {
    return value;
  }
  return [value];
};
