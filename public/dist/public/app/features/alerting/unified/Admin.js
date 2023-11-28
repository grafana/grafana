import React from 'react';
import { AlertmanagerPageWrapper } from './components/AlertingPageWrapper';
import AlertmanagerConfig from './components/admin/AlertmanagerConfig';
import { ExternalAlertmanagers } from './components/admin/ExternalAlertmanagers';
import { useAlertmanager } from './state/AlertmanagerContext';
import { GRAFANA_RULES_SOURCE_NAME } from './utils/datasource';
export default function Admin() {
    return (React.createElement(AlertmanagerPageWrapper, { pageId: "alerting-admin", accessType: "notification" },
        React.createElement(AdminPageContents, null)));
}
function AdminPageContents() {
    const { selectedAlertmanager } = useAlertmanager();
    const isGrafanaAmSelected = selectedAlertmanager === GRAFANA_RULES_SOURCE_NAME;
    return (React.createElement(React.Fragment, null,
        React.createElement(AlertmanagerConfig, { "test-id": "admin-alertmanagerconfig" }),
        isGrafanaAmSelected && React.createElement(ExternalAlertmanagers, { "test-id": "admin-externalalertmanagers" })));
}
//# sourceMappingURL=Admin.js.map