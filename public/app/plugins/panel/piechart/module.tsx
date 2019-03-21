import { ReactPanelPlugin } from '@grafana/ui';

import PieChartPanelEditor from './PieChartPanelEditor';
import { PieChartPanel } from './PieChartPanel';
import { PieChartOptions, defaults } from './types';

export const reactPanel = new ReactPanelPlugin<PieChartOptions>(PieChartPanel);

reactPanel.setEditor(PieChartPanelEditor);
reactPanel.setDefaults(defaults);
