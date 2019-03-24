import { ReactPanelPlugin } from '@grafana/ui';

import { TextPanelEditor } from './TextPanelEditor';
import { TextPanel } from './TextPanel';
import { TextOptions, defaults } from './types';

export const reactPanel = new ReactPanelPlugin<TextOptions>(TextPanel, defaults);

reactPanel.editor = TextPanelEditor;
reactPanel.onPanelTypeChanged = (options: TextOptions, prevPluginId: string, prevOptions: any) => {
  if (prevPluginId === 'text') {
    return prevOptions as TextOptions;
  }
  return options;
};
