import { PanelModel, PanelPlugin } from '@grafana/data';

import { TextPanelEditor } from './TextPanelEditor';
import { TextPanel } from './TextPanel';
import { TextOptions, defaults } from './types';

export const plugin = new PanelPlugin<TextOptions>(TextPanel)
  .setDefaults(defaults)
  .setEditor(TextPanelEditor)
  .setPanelChangeHandler((panel: PanelModel<TextOptions>, prevPluginId: string, prevOptions: any) => {
    if (prevPluginId === 'text') {
      return prevOptions as TextOptions;
    }
    return panel.options;
  });
