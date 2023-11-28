import React from 'react';
import { Modal, VerticalGroup } from '@grafana/ui';
export function AlertHowToModal({ onDismiss }) {
    return (React.createElement(Modal, { title: "Adding an Alert", isOpen: true, onDismiss: onDismiss, onClickBackdrop: onDismiss },
        React.createElement(VerticalGroup, { spacing: "sm" },
            React.createElement("img", { src: "public/img/alert_howto_new.png", alt: "" }),
            React.createElement("p", null, "Alerts are added and configured in the Alert tab of any dashboard graph panel, letting you build and visualize an alert using existing queries."),
            React.createElement("p", null, "Remember to save the dashboard to persist your alert rule changes."))));
}
//# sourceMappingURL=AlertHowToModal.js.map