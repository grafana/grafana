import { PanelPlugin } from '@grafana/data';
import { Options, defaults } from './types';
import { LogsPanel } from './LogsPanel';
import { LogsPanelEditor } from './LogsPanelEditor';

export const plugin = new PanelPlugin<Options>(LogsPanel).setDefaults(defaults).setEditor(LogsPanelEditor);
