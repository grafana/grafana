import React from 'react';
import { locationUtil } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { Button, Modal, VerticalGroup } from '@grafana/ui';
export function ConfirmNavigationModal(props) {
    const { onDismiss, path, title } = props;
    const openInNewTab = () => {
        global.open(locationUtil.assureBaseUrl(path), '_blank');
        onDismiss();
    };
    const openInCurrentTab = () => locationService.push(path);
    return (React.createElement(Modal, { title: title, isOpen: true, onDismiss: onDismiss },
        React.createElement(VerticalGroup, { spacing: "sm" },
            React.createElement("p", null, "Do you want to proceed in the current tab or open a new tab?")),
        React.createElement(Modal.ButtonRow, null,
            React.createElement(Button, { onClick: onDismiss, fill: "outline", variant: "secondary" }, "Cancel"),
            React.createElement(Button, { type: "submit", variant: "secondary", onClick: openInNewTab, icon: "external-link-alt" }, "Open in new tab"),
            React.createElement(Button, { type: "submit", variant: "primary", onClick: openInCurrentTab, icon: "apps" }, "Open"))));
}
//# sourceMappingURL=ConfirmNavigationModal.js.map