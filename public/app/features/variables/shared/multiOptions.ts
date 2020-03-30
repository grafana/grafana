import { VariableWithMultiSupport } from 'app/features/templating/types';

export const changeMultiTo = <Variable extends VariableWithMultiSupport>(variable: Variable, value: boolean): void => {
  const { current } = variable;

  if (value && !Array.isArray(current.value)) {
    variable.multi = value;
    variable.current.value = convertToMulti(current.value);
    return;
  }

  if (!value && Array.isArray(current.value)) {
    variable.multi = value;
    variable.current.value = convertToSingle(current.value);
    variable.current.text = convertToSingle(current.text);
    return;
  }

  variable.multi = value;
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
