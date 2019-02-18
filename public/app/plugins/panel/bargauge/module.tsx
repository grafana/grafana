import { ReactPanelPlugin } from '@grafana/ui';

import { BarGaugePanel } from './BarGaugePanel';
import { BarGaugePanelEditor } from './BarGaugePanelEditor';
import { BarGaugeOptions, defaults } from './types';

export const reactPanel = new ReactPanelPlugin<BarGaugeOptions>(BarGaugePanel);
reactPanel.setEditor(BarGaugePanelEditor);
reactPanel.setDefaults(defaults);
