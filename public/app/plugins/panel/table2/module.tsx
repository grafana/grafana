import { PanelPlugin } from '@grafana/data';

import { TablePanelEditor } from './TablePanelEditor';
import { TablePanel } from './TablePanel';
import { tableFieldRegistry } from './custom';
import { Options, defaults } from './types';

export const plugin = new PanelPlugin<Options>(TablePanel)
  .setDefaults(defaults)
  .setCustomFieldConfigs(tableFieldRegistry)
  .setEditor(TablePanelEditor);
