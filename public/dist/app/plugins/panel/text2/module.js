import { ReactPanelPlugin } from '@grafana/ui';
import { TextPanelEditor } from './TextPanelEditor';
import { TextPanel } from './TextPanel';
import { defaults } from './types';
export var reactPanel = new ReactPanelPlugin(TextPanel);
reactPanel.setEditor(TextPanelEditor);
reactPanel.setDefaults(defaults);
reactPanel.setPanelTypeChangedHook(function (options, prevPluginId, prevOptions) {
    if (prevPluginId === 'text') {
        return prevOptions;
    }
    return options;
});
//# sourceMappingURL=module.js.map