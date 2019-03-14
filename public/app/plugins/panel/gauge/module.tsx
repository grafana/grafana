import { ReactPanelPlugin, DisplayValueOptions } from '@grafana/ui';
import cloneDeep from 'lodash/cloneDeep';

import { GaugePanelEditor } from './GaugePanelEditor';
import { GaugePanel } from './GaugePanel';
import { GaugeOptions, defaults } from './types';

export const reactPanel = new ReactPanelPlugin<GaugeOptions>(GaugePanel);

// Bar Gauge uses the same handler

const optionsToCheck = ['display', 'stat', 'maxValue', 'maxValue'];

export const gaugePanelTypeChangedHook = (options: Partial<GaugeOptions>, prevPluginId?: string, prevOptions?: any) => {
  // TODO! migrate to new settings format
  //
  // thresholds?: Threshold[];
  // valueMappings?: ValueMapping[];
  // valueOptions?: SingleStatValueOptions;
  //
  // if (props.options.valueOptions) {
  //   console.warn('TODO!! how do we best migration options?');
  // }

  // 6.0 -> 6.1, settings were stored on the root, now moved to display
  if (!options.display && !prevOptions && options.hasOwnProperty('thresholds')) {
    console.log('Migrating old gauge settings format', options);
    const migrate = options as any;
    const display = (migrate.valueOptions || {}) as DisplayValueOptions;

    display.thresholds = migrate.thresholds;
    display.mappings = migrate.valueMappings;
    if (migrate.valueMappings) {
      options.stat = migrate.valueMappings.stat;
      delete migrate.valueMappings.stat;
    }

    delete migrate.valueOptions;
    delete migrate.thresholds;
    delete migrate.valueMappings;

    options.display = display;
  }

  if (prevOptions) {
    optionsToCheck.forEach(v => {
      if (prevOptions.hasOwnProperty(v)) {
        options[v] = cloneDeep(prevOptions.display);
      }
    });
  }

  return options;
};

reactPanel.setEditor(GaugePanelEditor);
reactPanel.setDefaults(defaults);
reactPanel.setPanelTypeChangedHook(gaugePanelTypeChangedHook);
