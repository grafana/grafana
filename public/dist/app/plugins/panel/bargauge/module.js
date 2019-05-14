import { ReactPanelPlugin } from '@grafana/ui';
import { BarGaugePanel } from './BarGaugePanel';
import { BarGaugePanelEditor } from './BarGaugePanelEditor';
import { defaults } from './types';
import { singleStatBaseOptionsCheck } from '../singlestat2/module';
export var reactPanel = new ReactPanelPlugin(BarGaugePanel);
reactPanel.setEditor(BarGaugePanelEditor);
reactPanel.setDefaults(defaults);
reactPanel.setPanelTypeChangedHook(singleStatBaseOptionsCheck);
//# sourceMappingURL=module.js.map