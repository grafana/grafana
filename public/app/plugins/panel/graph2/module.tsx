import { ReactPanelPlugin } from '@grafana/ui';

import { GraphPanelEditor } from './GraphPanelEditor';
import { GraphPanel } from './GraphPanel';
import { GraphOptions, defaults } from './types';

export const reactPanel = new ReactPanelPlugin<GraphOptions>(GraphPanel);
reactPanel.setEditor(GraphPanelEditor);
reactPanel.setDefaults(defaults);
