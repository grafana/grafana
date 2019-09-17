import { PanelPlugin } from '@grafana/ui';
import { Options, defaults } from './types';
import { LogsPanel } from './LogsPanel';
import { LogsPanelEditor } from './LogsPanelEditor';

export const plugin = new PanelPlugin<Options>(LogsPanel).setDefaults(defaults).setEditor(LogsPanelEditor);
