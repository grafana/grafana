import { Modal, VerticalGroup } from '@grafana/ui';
import React from 'react';
export function AlertHowToModal(_a) {
    var onDismiss = _a.onDismiss;
    return (React.createElement(Modal, { title: "Adding an Alert", isOpen: true, onDismiss: onDismiss, onClickBackdrop: onDismiss },
        React.createElement(VerticalGroup, { spacing: "sm" },
            React.createElement("img", { src: "public/img/alert_howto_new.png", alt: "link to how to alert image" }),
            React.createElement("p", null, "Alerts are added and configured in the Alert tab of any dashboard graph panel, letting you build and visualize an alert using existing queries."),
            React.createElement("p", null, "Remember to save the dashboard to persist your alert rule changes."))));
}
//# sourceMappingURL=AlertHowToModal.js.map