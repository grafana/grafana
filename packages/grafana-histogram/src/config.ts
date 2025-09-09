import { StackingMode } from '@grafana/schema';

import { FieldConfig } from './panelcfg.gen';

export const defaultHistogramConfig: FieldConfig = {
  stacking: {
    mode: StackingMode.None,
    group: 'A',
  },
};
