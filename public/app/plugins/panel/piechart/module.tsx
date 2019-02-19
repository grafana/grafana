import { ReactPanelPlugin } from '@grafana/ui';

import PiechartPanelEditor from './PiechartPanelEditor';
import { PiechartPanel } from './PiechartPanel';
import { PiechartOptions, defaults } from './types';

export const reactPanel = new ReactPanelPlugin<PiechartOptions>(PiechartPanel);

reactPanel.setEditor(PiechartPanelEditor);
reactPanel.setDefaults(defaults);
