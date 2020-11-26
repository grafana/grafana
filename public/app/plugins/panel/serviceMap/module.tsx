import { PanelPlugin } from '@grafana/data';
import { ServiceMapPanel } from './ServiceMapPanel';
import { Options } from './types';

export const plugin = new PanelPlugin<Options>(ServiceMapPanel);
