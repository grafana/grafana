import React from 'react';
import { Tooltip, ToolbarButton } from '@grafana/ui';
export function TimeSyncButton(props) {
    var onClick = props.onClick, isSynced = props.isSynced;
    var syncTimesTooltip = function () {
        var isSynced = props.isSynced;
        var tooltip = isSynced ? 'Unsync all views' : 'Sync all views to this time range';
        return React.createElement(React.Fragment, null, tooltip);
    };
    return (React.createElement(Tooltip, { content: syncTimesTooltip, placement: "bottom" },
        React.createElement(ToolbarButton, { icon: "link", variant: isSynced ? 'active' : 'default', "aria-label": isSynced ? 'Synced times' : 'Unsynced times', onClick: onClick })));
}
//# sourceMappingURL=TimeSyncButton.js.map