import { ReactPanelPlugin } from '@grafana/ui';
import { GraphPanelEditor } from './GraphPanelEditor';
import { GraphPanel } from './GraphPanel';
import { Options, defaults } from './types';

export const reactPanel = new ReactPanelPlugin<Options>(GraphPanel).setDefaults(defaults).setEditor(GraphPanelEditor);
