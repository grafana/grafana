import { css } from '@emotion/css';
import React, { useState } from 'react';
import { Alert, Button, ConfirmModal, useStyles2 } from '@grafana/ui';
export const MigrateToServiceAccountsCard = ({ onMigrate, apikeysCount, disabled }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const styles = useStyles2(getStyles);
    const docsLink = (React.createElement("a", { className: "external-link", href: "https://grafana.com/docs/grafana/latest/administration/api-keys/#migrate-api-keys-to-grafana-service-accounts", target: "_blank", rel: "noopener noreferrer" }, "Find out more about the migration here."));
    const migrationBoxDesc = (React.createElement("span", null,
        "Migrating all API keys will hide the API keys tab.",
        React.createElement("br", null),
        React.createElement("br", null),
        "The API keys API will remain available for you to create new API keys, but we strongly encourage you to use Service accounts instead."));
    return (React.createElement(React.Fragment, null,
        apikeysCount > 0 && (React.createElement(Alert, { title: "Switch from API keys to service accounts", severity: "warning" },
            React.createElement("div", { className: styles.text },
                "We will soon deprecate API keys. Each API key will be migrated into a service account with a token and will continue to work as they were. We encourage you to migrate your API keys to service accounts now. ",
                docsLink),
            React.createElement("div", { className: styles.actionRow },
                React.createElement(Button, { className: styles.actionButton, onClick: () => setIsModalOpen(true) }, "Migrate all service accounts"),
                React.createElement(ConfirmModal, { title: 'Migrate API keys to Service accounts', isOpen: isModalOpen, body: migrationBoxDesc, confirmText: 'Yes, migrate now', onConfirm: onMigrate, onDismiss: () => setIsModalOpen(false), confirmVariant: "primary", confirmButtonVariant: "primary" })))),
        apikeysCount === 0 && (React.createElement(React.Fragment, null,
            React.createElement(Alert, { title: "No API keys found", severity: "warning" },
                React.createElement("div", { className: styles.text }, "No API keys were found. If you reload the browser, this tab will be not available. If any API keys are created, this tab will appear again."))))));
};
export const getStyles = (theme) => ({
    text: css `
    margin-bottom: ${theme.spacing(2)};
  `,
    actionRow: css `
    display: flex;
    align-items: center;
  `,
    actionButton: css `
    margin-right: ${theme.spacing(2)};
  `,
});
//# sourceMappingURL=MigrateToServiceAccountsCard.js.map