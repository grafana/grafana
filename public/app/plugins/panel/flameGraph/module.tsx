import { PanelPlugin } from '@grafana/data';
import { Options } from './types';
import { FlameGraphPanel } from './FlameGraphPanel';

export const plugin = new PanelPlugin<Options>(FlameGraphPanel);
