import { VizPanelPlugin, sharedSingleStatOptionsCheck } from '@grafana/ui';

import { BarGaugePanel } from './BarGaugePanel';
import { BarGaugePanelEditor } from './BarGaugePanelEditor';
import { BarGaugeOptions, defaults } from './types';

export const plugin = new VizPanelPlugin<BarGaugeOptions>(BarGaugePanel)
  .setDefaults(defaults)
  .setEditor(BarGaugePanelEditor)
  .setPanelChangeHandler(sharedSingleStatOptionsCheck);
