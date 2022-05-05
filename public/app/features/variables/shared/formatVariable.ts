import { VariableModel } from '@grafana/data';

import { VariableWithOptions } from '../types';

export const formatVariableLabel = (variable: VariableModel) => {
  if (!isVariableWithOptions(variable)) {
    return variable.name;
  }

  const { current } = variable;

  if (Array.isArray(current.text)) {
    return current.text.join(' + ');
  }

  return current.text;
};

const isVariableWithOptions = (variable: VariableModel): variable is VariableWithOptions => {
  return (
    Array.isArray((variable as VariableWithOptions)?.options) ||
    typeof (variable as VariableWithOptions)?.current === 'object'
  );
};
