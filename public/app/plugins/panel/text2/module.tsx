import { ReactPanelPlugin } from '@grafana/ui';

import { TextPanelEditor } from './TextPanelEditor';
import { TextPanel } from './TextPanel';
import { TextOptions, defaults } from './types';

export const reactPanel = new ReactPanelPlugin<TextOptions>(TextPanel);

reactPanel.setEditor(TextPanelEditor);
reactPanel.setDefaults(defaults);
reactPanel.setPanelTypeChangedHook((options: TextOptions, prevPluginId: string, prevOptions: any) => {
  if (prevPluginId === 'text') {
    return prevOptions as TextOptions;
  }

  return options;
});
