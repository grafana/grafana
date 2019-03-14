import { ReactPanelPlugin } from '@grafana/ui';
import cloneDeep from 'lodash/cloneDeep';

import { GaugePanelEditor } from './GaugePanelEditor';
import { GaugePanel } from './GaugePanel';
import { GaugeOptions, defaults } from './types';

export const reactPanel = new ReactPanelPlugin<GaugeOptions>(GaugePanel);

// Bar Gauge uses the same handler
export const gaugePreserveOptionsHandler = (pluginId: string, prevOptions: any) => {
  const options: Partial<GaugeOptions> = {};

  // TODO! migrate to new settings format
  //
  // thresholds?: Threshold[];
  // valueMappings?: ValueMapping[];
  // valueOptions?: SingleStatValueOptions;
  //
  // if (props.options.valueOptions) {
  //   console.warn('TODO!! how do we best migration options?');
  // }

  if (prevOptions.display) {
    options.stat = prevOptions.stat;
    options.display = cloneDeep(prevOptions.display);
    options.maxValue = prevOptions.maxValue;
    options.minValue = prevOptions.minValue;
  }

  return options;
};

reactPanel.setEditor(GaugePanelEditor);
reactPanel.setDefaults(defaults);
reactPanel.setPreserveOptionsHandler(gaugePreserveOptionsHandler);
