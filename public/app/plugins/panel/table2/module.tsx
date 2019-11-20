import { PanelPlugin } from '@grafana/data';

import { TablePanelEditor } from './TablePanelEditor';
import { TablePanel } from './TablePanel';
import { TablePanelOptions, defaults } from './types';

export const plugin = new PanelPlugin<TablePanelOptions>(TablePanel).setDefaults(defaults).setEditor(TablePanelEditor);
