import { VizPanelPlugin } from '@grafana/ui';
import { GraphPanelEditor } from './GraphPanelEditor';
import { GraphPanel } from './GraphPanel';
import { Options, defaults } from './types';

export const plugin = new VizPanelPlugin<Options>(GraphPanel).setDefaults(defaults).setEditor(GraphPanelEditor);
