import { ReactPanelPlugin } from '@grafana/ui';

import { GraphPanelEditor } from './GraphPanelEditor';
import { GraphPanel } from './GraphPanel';
import { Options, defaults } from './types';

export const reactPanel = new ReactPanelPlugin<Options>(GraphPanel, defaults);

reactPanel.editor = GraphPanelEditor;
