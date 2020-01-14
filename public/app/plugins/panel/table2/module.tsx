import { PanelPlugin } from '@grafana/data';

import { TablePanelEditor } from './TablePanelEditor';
import { TablePanel } from './TablePanel';
import { Options, defaults } from './types';

export const plugin = new PanelPlugin<Options>(TablePanel)
  .setNoPadding()
  .setDefaults(defaults)
  .setEditor(TablePanelEditor);
