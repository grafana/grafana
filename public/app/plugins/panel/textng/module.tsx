import { PanelPlugin } from '@grafana/data';

import { TextNGPanel } from './TextNGPanel';

export const plugin = new PanelPlugin(TextNGPanel);
