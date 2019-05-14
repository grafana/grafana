import { ReactPanelPlugin } from '@grafana/ui';
import { defaults } from './types';
import { SingleStatPanel } from './SingleStatPanel';
import cloneDeep from 'lodash/cloneDeep';
import { SingleStatEditor } from './SingleStatEditor';
export var reactPanel = new ReactPanelPlugin(SingleStatPanel);
var optionsToKeep = ['valueOptions', 'stat', 'maxValue', 'maxValue', 'thresholds', 'valueMappings'];
export var singleStatBaseOptionsCheck = function (options, prevPluginId, prevOptions) {
    if (prevOptions) {
        optionsToKeep.forEach(function (v) {
            if (prevOptions.hasOwnProperty(v)) {
                options[v] = cloneDeep(prevOptions.display);
            }
        });
    }
    return options;
};
reactPanel.setEditor(SingleStatEditor);
reactPanel.setDefaults(defaults);
reactPanel.setPanelTypeChangedHook(singleStatBaseOptionsCheck);
//# sourceMappingURL=module.js.map