import { PanelPlugin } from '@grafana/data';

import { StreamPanelEditor } from './StreamPanelEditor';
import { StreamPanel } from './StreamPanel';
import { StreamOptions, defaults } from './types';

export const plugin = new PanelPlugin<StreamOptions>(StreamPanel).setDefaults(defaults).setEditor(StreamPanelEditor);
