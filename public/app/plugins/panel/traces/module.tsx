import { PanelPlugin } from '@grafana/data';

import { TracesPanel } from './TracesPanel';

export const plugin = new PanelPlugin(TracesPanel);
