import { type TypedVariableModel, type VariableWithOptions } from '@grafana/data';

export const formatVariableLabel = (variable: VariableWithOptions | TypedVariableModel) => {
  if (!isVariableWithOptions(variable)) {
    return variable.name;
  }

  const { current } = variable;

  if (Array.isArray(current.text)) {
    return current.text.join(' + ');
  }

  return current.text;
};

const isVariableWithOptions = (variable: {
  name: string;
  options?: unknown;
  current?: unknown;
}): variable is VariableWithOptions => {
  return Array.isArray(variable?.options) || typeof variable?.current === 'object';
};
