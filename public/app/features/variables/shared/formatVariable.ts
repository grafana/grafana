import type { TypedVariableModel, VariableWithOptions } from '@grafana/data/types';

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

const isVariableWithOptions = (variable: unknown): variable is VariableWithOptions => {
  return (
    Array.isArray((variable as VariableWithOptions)?.options) ||
    typeof (variable as VariableWithOptions)?.current === 'object'
  );
};
