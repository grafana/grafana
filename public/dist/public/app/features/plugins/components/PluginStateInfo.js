import React from 'react';
import { PluginState } from '@grafana/data';
import { Badge } from '@grafana/ui';
export const PluginStateInfo = (props) => {
    const display = getFeatureStateInfo(props.state);
    if (!display) {
        return null;
    }
    return (React.createElement(Badge, { className: props.className, color: display.color, title: display.tooltip, text: display.text, icon: display.icon }));
};
function getFeatureStateInfo(state) {
    switch (state) {
        case PluginState.deprecated:
            return {
                text: 'Deprecated',
                color: 'red',
                tooltip: `This feature is deprecated and will be removed in a future release`,
            };
        case PluginState.alpha:
            return {
                text: 'Alpha',
                color: 'blue',
                tooltip: `This feature is experimental and future updates might not be backward compatible`,
            };
        case PluginState.beta:
            return {
                text: 'Beta',
                color: 'blue',
                tooltip: `This feature is close to complete but not fully tested`,
            };
        default:
            return null;
    }
}
//# sourceMappingURL=PluginStateInfo.js.map