import { PanelPlugin } from '@grafana/data';
import { GraphPanelEditor } from './GraphPanelEditor';
import { GraphPanel } from './GraphPanel';
import { Options, defaults } from './types';

export const plugin = new PanelPlugin<Options>(GraphPanel).setDefaults(defaults).setEditor(GraphPanelEditor);
