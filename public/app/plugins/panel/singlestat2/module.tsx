import { ReactPanelPlugin } from '@grafana/ui';
import { SingleStatOptions, defaults } from './types';
import { SingleStatPanel } from './SingleStatPanel';
import cloneDeep from 'lodash/cloneDeep';
import { SingleStatEditor } from './SingleStatEditor';

export const reactPanel = new ReactPanelPlugin<SingleStatOptions>(SingleStatPanel);

const optionsToKeep = ['valueOptions', 'stat', 'maxValue', 'maxValue', 'thresholds', 'valueMappings'];

export const singleStatOptionsCheck = (
  options: Partial<SingleStatOptions>,
  prevPluginId?: string,
  prevOptions?: any
) => {
  if (prevOptions) {
    optionsToKeep.forEach(v => {
      if (prevOptions.hasOwnProperty(v)) {
        options[v] = cloneDeep(prevOptions.display);
      }
    });
  }

  return options;
};

reactPanel.setEditor(SingleStatEditor);
reactPanel.setDefaults(defaults);
reactPanel.setPanelTypeChangedHook(singleStatOptionsCheck);
