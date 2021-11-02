import { config } from '@grafana/runtime';
import { RadioButtonGroup } from '@grafana/ui';
import React, { useMemo } from 'react';
import { STAT, TABLE, TIMESERIES } from '../utils/constants';
export function PanelPluginsButtonGroup(props) {
    var value = props.value, onChange = props.onChange, _a = props.size, size = _a === void 0 ? 'md' : _a;
    var panels = useMemo(function () { return getSupportedPanels(); }, []);
    return React.createElement(RadioButtonGroup, { options: panels, value: value, onChange: onChange, size: size });
}
function getSupportedPanels() {
    return Object.values(config.panels).reduce(function (panels, panel) {
        if (isSupportedPanelPlugin(panel.id)) {
            panels.push({
                value: panel.id,
                label: panel.name,
                imgUrl: panel.info.logos.small,
            });
        }
        return panels;
    }, []);
}
function isSupportedPanelPlugin(id) {
    switch (id) {
        case TIMESERIES:
        case TABLE:
        case STAT:
            return true;
        default:
            return false;
    }
}
//# sourceMappingURL=PanelPluginsButtonGroup.js.map