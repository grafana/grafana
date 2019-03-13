import { ReactPanelPlugin } from '@grafana/ui';

import { TextPanelEditor } from './TextPanelEditor';
import { TextPanel } from './TextPanel';
import { TextOptions, defaults } from './types';
import { PanelModel } from 'app/features/dashboard/state';

import get from 'lodash/get';
import cloneDeep from 'lodash/cloneDeep';

export const reactPanel = new ReactPanelPlugin<TextOptions>(TextPanel);

const validator = (model: PanelModel): TextOptions => {
  const options = model.options as TextOptions;
  if (!options) {
    // Use the same settings from an existing 'text' panel
    return cloneDeep(get(model, 'cachedPluginOptions.text'));
  }
  return options;
};

reactPanel.setEditor(TextPanelEditor);
reactPanel.setDefaults(defaults);
reactPanel.setOptionsValidator(validator);
