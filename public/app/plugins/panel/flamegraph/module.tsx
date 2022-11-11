import { PanelPlugin } from '@grafana/data';

import { FlameGraphPanel } from './FlameGraphPanel';

export const plugin = new PanelPlugin(FlameGraphPanel);
