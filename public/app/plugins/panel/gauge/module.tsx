import { ReactPanelPlugin } from '@grafana/ui';

import { GaugePanelEditor } from './GaugePanelEditor';
import { GaugePanel } from './GaugePanel';
import { GaugeOptions, defaults } from './types';

export const reactPanel = new ReactPanelPlugin<GaugeOptions>(GaugePanel);

reactPanel.setEditor(GaugePanelEditor);
reactPanel.setDefaults(defaults);
reactPanel.setPreserveOptionsHandler((pluginId: string, prevOptions: any) => {
  const options: Partial<GaugeOptions> = {};

  if (prevOptions.valueOptions) {
    options.valueOptions = prevOptions.valueOptions;
    options.thresholds = prevOptions.thresholds;
    options.maxValue = prevOptions.maxValue;
    options.minValue = prevOptions.minValue;
  }

  return options;
});
