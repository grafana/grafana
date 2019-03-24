import { ReactPanelPlugin } from '@grafana/ui';

import PieChartPanelEditor from './PieChartPanelEditor';
import { PieChartPanel } from './PieChartPanel';
import { PieChartOptions, defaults } from './types';
import { singleStatBaseOptionsCheck } from '../singlestat2/module';

export const reactPanel = new ReactPanelPlugin<PieChartOptions>(PieChartPanel, defaults);

reactPanel.editor = PieChartPanelEditor;
reactPanel.onPanelTypeChanged = singleStatBaseOptionsCheck;
