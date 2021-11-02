import React from 'react';
import { PanelTypeCard } from './PanelTypeCard';
export var VizTypePickerPlugin = function (_a) {
    var isCurrent = _a.isCurrent, plugin = _a.plugin, onClick = _a.onClick, disabled = _a.disabled;
    return (React.createElement(PanelTypeCard, { title: plugin.name, plugin: plugin, description: plugin.info.description, onClick: onClick, isCurrent: isCurrent, disabled: disabled, showBadge: true }));
};
VizTypePickerPlugin.displayName = 'VizTypePickerPlugin';
//# sourceMappingURL=VizTypePickerPlugin.js.map