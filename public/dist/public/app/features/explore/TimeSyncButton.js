import React from 'react';
import { Tooltip, ToolbarButton } from '@grafana/ui';
export function TimeSyncButton(props) {
    const { onClick, isSynced } = props;
    const syncTimesTooltip = () => {
        const { isSynced } = props;
        const tooltip = isSynced ? 'Unsync all views' : 'Sync all views to this time range';
        return React.createElement(React.Fragment, null, tooltip);
    };
    return (React.createElement(Tooltip, { content: syncTimesTooltip, placement: "bottom" },
        React.createElement(ToolbarButton, { icon: "link", variant: isSynced ? 'active' : 'canvas', "aria-label": isSynced ? 'Synced times' : 'Unsynced times', onClick: onClick })));
}
//# sourceMappingURL=TimeSyncButton.js.map