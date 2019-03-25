import { ReactPanelPlugin } from '@grafana/ui';

import { BarGaugePanel } from './BarGaugePanel';
import { BarGaugePanelEditor } from './BarGaugePanelEditor';
import { BarGaugeOptions, defaults } from './types';
import { singleStatBaseOptionsCheck } from '../singlestat2/module';

export const reactPanel = new ReactPanelPlugin<BarGaugeOptions>(BarGaugePanel)
  .setDefaults(defaults)
  .setEditor(BarGaugePanelEditor)
  .setPanelChangeHandler(singleStatBaseOptionsCheck);
