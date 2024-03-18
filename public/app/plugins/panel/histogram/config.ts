import { StackingMode, StackableFieldConfig } from '@grafana/schema';

export const defaultHistogramConfig: StackableFieldConfig = {
  stacking: {
    mode: StackingMode.None,
    group: 'A',
  },
};
