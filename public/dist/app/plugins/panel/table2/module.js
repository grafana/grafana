import { ReactPanelPlugin } from '@grafana/ui';
import { TablePanelEditor } from './TablePanelEditor';
import { TablePanel } from './TablePanel';
import { defaults } from './types';
export var reactPanel = new ReactPanelPlugin(TablePanel);
reactPanel.setEditor(TablePanelEditor);
reactPanel.setDefaults(defaults);
//# sourceMappingURL=module.js.map