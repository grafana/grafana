import { ReactPanelPlugin } from '@grafana/ui';

import { BarGaugePanel } from './BarGaugePanel';
import { BarGaugePanelEditor } from './BarGaugePanelEditor';
import { BarGaugeOptions, defaults } from './types';
import { singleStatBaseOptionsCheck } from '../singlestat2/module';

export const reactPanel = new ReactPanelPlugin<BarGaugeOptions>(BarGaugePanel, defaults);

reactPanel.editor = BarGaugePanelEditor;
reactPanel.onPanelTypeChanged = singleStatBaseOptionsCheck;
