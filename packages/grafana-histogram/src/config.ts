import { StackingMode } from '@grafana/schema';

import { HistogramFieldConfig } from './types';

export const defaultHistogramConfig: HistogramFieldConfig = {
  stacking: {
    mode: StackingMode.None,
    group: 'A',
  },
};
