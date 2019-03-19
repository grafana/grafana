import { ReactPanelPlugin } from '@grafana/ui';

import { LHeatmapPanelEditor } from './LHeatmapPanelEditor';
import { LHeatmapPanel } from './LHeatmapPanel';
import { LHeatmapOptions, defaults } from './types';

export const reactPanel = new ReactPanelPlugin<LHeatmapOptions>(LHeatmapPanel);

reactPanel.setEditor(LHeatmapPanelEditor);
reactPanel.setDefaults(defaults);
