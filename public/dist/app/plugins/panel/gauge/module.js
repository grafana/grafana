import { ReactPanelPlugin } from '@grafana/ui';
import { GaugePanelEditor } from './GaugePanelEditor';
import { GaugePanel } from './GaugePanel';
import { defaults } from './types';
import { singleStatBaseOptionsCheck } from '../singlestat2/module';
export var reactPanel = new ReactPanelPlugin(GaugePanel);
reactPanel.setEditor(GaugePanelEditor);
reactPanel.setDefaults(defaults);
reactPanel.setPanelTypeChangedHook(singleStatBaseOptionsCheck);
//# sourceMappingURL=module.js.map