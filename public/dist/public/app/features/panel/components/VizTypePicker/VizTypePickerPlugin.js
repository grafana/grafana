import React from 'react';
import { PanelTypeCard } from './PanelTypeCard';
export const VizTypePickerPlugin = ({ isCurrent, plugin, onClick, disabled }) => {
    return (React.createElement(PanelTypeCard, { title: plugin.name, plugin: plugin, description: plugin.info.description, onClick: onClick, isCurrent: isCurrent, disabled: disabled, showBadge: true }));
};
VizTypePickerPlugin.displayName = 'VizTypePickerPlugin';
//# sourceMappingURL=VizTypePickerPlugin.js.map