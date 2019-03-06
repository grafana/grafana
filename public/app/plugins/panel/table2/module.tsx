import { ReactPanelPlugin } from '@grafana/ui';

import { TablePanelEditor } from './TablePanelEditor';
import { TablePanel } from './TablePanel';
import { Options, defaults } from './types';

export const reactPanel = new ReactPanelPlugin<Options>(TablePanel);
reactPanel.setEditor(TablePanelEditor);
reactPanel.setDefaults(defaults);
