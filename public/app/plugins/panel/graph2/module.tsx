import { ReactPanelPlugin } from '@grafana/ui';

import { GraphPanelEditor } from './GraphPanelEditor';
import { GraphPanel } from './GraphPanel';
import { Options } from './types';

export const reactPanel = new ReactPanelPlugin<Options>(GraphPanel);
reactPanel.setEditor(GraphPanelEditor);
