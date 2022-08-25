import { PanelPlugin } from '@grafana/data';

import { TraceViewExplorePanel } from './TracesExplorePanel';
import { TracesPanel } from './TracesPanel';

export const plugin = new PanelPlugin(TracesPanel).setExplorePanel(TraceViewExplorePanel);
