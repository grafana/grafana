import { ReactPanelPlugin } from '@grafana/ui';

import { BarGaugePanel } from './BarGaugePanel';
import { BarGaugePanelEditor } from './BarGaugePanelEditor';
import { BarGaugeOptions, defaults } from './types';

export const reactPanel = new ReactPanelPlugin<BarGaugeOptions>(BarGaugePanel);

reactPanel.setEditor(BarGaugePanelEditor);
reactPanel.setDefaults(defaults);
reactPanel.setPanelTypeChangedHook((options: BarGaugeOptions, prevPluginId?: string, prevOptions?: any) => {
  if (prevOptions && prevOptions.valueOptions) {
    options.valueOptions = prevOptions.valueOptions;
    options.thresholds = prevOptions.thresholds;
    options.maxValue = prevOptions.maxValue;
    options.minValue = prevOptions.minValue;
  }

  return options;
});
