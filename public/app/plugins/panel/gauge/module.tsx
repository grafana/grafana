import { ReactPanelPlugin } from '@grafana/ui';

import { GaugePanelEditor } from './GaugePanelEditor';
import { GaugePanel } from './GaugePanel';
import { GaugeOptions, defaults } from './types';
import { singleStatBaseOptionsCheck, singleStatMigrationCheck } from '../singlestat2/module';

export const reactPanel = new ReactPanelPlugin<GaugeOptions>(GaugePanel, defaults);

reactPanel.editor = GaugePanelEditor;
reactPanel.onPanelTypeChanged = singleStatBaseOptionsCheck;
reactPanel.onPanelMigration = singleStatMigrationCheck;
