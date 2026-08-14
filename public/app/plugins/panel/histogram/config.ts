import { StackingMode } from '@grafana/schema';

import { type FieldConfig } from './panelcfg.gen';

export const defaultHistogramConfig: FieldConfig = {
  stacking: {
    mode: StackingMode.None,
    group: 'A',
  },
};
