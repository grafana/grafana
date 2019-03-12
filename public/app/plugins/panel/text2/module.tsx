import { ReactPanelPlugin } from '@grafana/ui';

import { TextPanelEditor } from './TextPanelEditor';
import { TextPanel } from './TextPanel';
import { TextOptions, defaults } from './types';
import { PanelModel } from 'app/features/dashboard/state';

import get from 'lodash/get';

export const reactPanel = new ReactPanelPlugin<TextOptions>(TextPanel);

const validator = (model: PanelModel): TextOptions => {
  const options = model.options as TextOptions;
  if (!options) {
    const old = get(model, 'cachedPluginOptions.text');
    if (old) {
      return old;
    }
  }
  return options;
};

reactPanel.setEditor(TextPanelEditor);
reactPanel.setDefaults(defaults);
reactPanel.setOptionsValidator(validator);
