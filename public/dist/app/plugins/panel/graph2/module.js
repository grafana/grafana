import { ReactPanelPlugin } from '@grafana/ui';
import { GraphPanelEditor } from './GraphPanelEditor';
import { GraphPanel } from './GraphPanel';
export var reactPanel = new ReactPanelPlugin(GraphPanel);
reactPanel.setEditor(GraphPanelEditor);
//# sourceMappingURL=module.js.map