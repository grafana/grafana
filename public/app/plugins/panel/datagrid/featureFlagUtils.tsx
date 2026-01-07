import { evaluateBooleanFlag } from '@grafana/runtime/internal';

export const isDatagridEnabled = () => {
  return evaluateBooleanFlag('enableDatagridEditing', false);
};
