import React from 'react';
import { AlertingPageWrapper } from './components/AlertingPageWrapper';
import AlertmanagerConfig from './components/admin/AlertmanagerConfig';
import { ExternalAlertmanagers } from './components/admin/ExternalAlertmanagers';
export default function Admin() {
    return (React.createElement(AlertingPageWrapper, { pageId: "alerting-admin" },
        React.createElement(AlertmanagerConfig, null),
        React.createElement(ExternalAlertmanagers, null)));
}
//# sourceMappingURL=Admin.js.map