import { ReactPanelPlugin } from '@grafana/ui';

import { TextPanelEditor } from './TextPanelEditor';
import { TextPanel } from './TextPanel';
import { TextOptions, defaults } from './types';

export const reactPanel = new ReactPanelPlugin<TextOptions>(TextPanel);

reactPanel.setEditor(TextPanelEditor);
reactPanel.setDefaults(defaults);
