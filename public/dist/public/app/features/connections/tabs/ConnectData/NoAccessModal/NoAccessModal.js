import { css } from '@emotion/css';
import React from 'react';
import { useStyles2, Modal, Icon, Button } from '@grafana/ui';
const getStyles = (theme) => ({
    modal: css `
    width: 500px;
  `,
    modalContent: css `
    overflow: visible;
    color: ${theme.colors.text.secondary};

    a {
      color: ${theme.colors.text.link};
    }
  `,
    description: css `
    margin-bottom: ${theme.spacing(2)};
  `,
    bottomSection: css `
    display: flex;
    border-top: 1px solid ${theme.colors.border.weak};
    padding-top: ${theme.spacing(3)};
    margin-top: ${theme.spacing(3)};
  `,
    actionsSection: css `
    display: flex;
    justify-content: end;
    margin-top: ${theme.spacing(3)};
  `,
    warningIcon: css `
    color: ${theme.colors.warning.main};
    padding-right: ${theme.spacing()};
    margin-top: ${theme.spacing(0.25)};
  `,
    header: css `
    display: flex;
    align-items: center;
  `,
    headerTitle: css `
    margin: 0;
  `,
    headerLogo: css `
    margin-right: ${theme.spacing(2)};
    width: 32px;
    height: 32px;
  `,
});
export function NoAccessModal({ item, isOpen, onDismiss }) {
    const styles = useStyles2(getStyles);
    return (React.createElement(Modal, { className: styles.modal, contentClassName: styles.modalContent, title: React.createElement(NoAccessModalHeader, { item: item }), isOpen: isOpen, onDismiss: onDismiss },
        React.createElement("div", null,
            React.createElement("div", null,
                item.description && React.createElement("div", { className: styles.description }, item.description),
                React.createElement("div", null,
                    "Links",
                    React.createElement("br", null),
                    React.createElement("a", { href: `https://grafana.com/grafana/plugins/${item.id}`, title: `${item.name} on Grafana.com`, target: "_blank", rel: "noopener noreferrer" }, item.name))),
            React.createElement("div", { className: styles.bottomSection },
                React.createElement("div", { className: styles.warningIcon },
                    React.createElement(Icon, { name: "exclamation-triangle" })),
                React.createElement("div", null,
                    React.createElement("p", null,
                        "Editors cannot add new connections. You may check to see if it is already configured in",
                        ' ',
                        React.createElement("a", { href: "/connections/datasources" }, "Data sources"),
                        "."),
                    React.createElement("p", null, "To add a new connection, contact your Grafana admin."))),
            React.createElement("div", { className: styles.actionsSection },
                React.createElement(Button, { onClick: onDismiss }, "Okay")))));
}
export function NoAccessModalHeader({ item }) {
    const styles = useStyles2(getStyles);
    return (React.createElement("div", null,
        React.createElement("div", { className: styles.header },
            item.logo && React.createElement("img", { className: styles.headerLogo, src: item.logo, alt: `logo of ${item.name}` }),
            React.createElement("h4", { className: styles.headerTitle }, item.name))));
}
//# sourceMappingURL=NoAccessModal.js.map