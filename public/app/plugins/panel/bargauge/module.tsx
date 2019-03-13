import { ReactPanelPlugin } from '@grafana/ui';
import cloneDeep from 'lodash/cloneDeep';

import { BarGaugePanel } from './BarGaugePanel';
import { BarGaugePanelEditor } from './BarGaugePanelEditor';
import { BarGaugeOptions, defaults } from './types';

export const reactPanel = new ReactPanelPlugin<BarGaugeOptions>(BarGaugePanel);

reactPanel.setEditor(BarGaugePanelEditor);
reactPanel.setDefaults(defaults);
reactPanel.setPreserveOptionsHandler((pluginId: string, prevOptions: any) => {
  const options: Partial<BarGaugeOptions> = {};

  if (prevOptions.display) {
    options.stat = prevOptions.stat;
    options.display = cloneDeep(prevOptions.display);
    options.maxValue = prevOptions.maxValue;
    options.minValue = prevOptions.minValue;
  }

  return options;
});
