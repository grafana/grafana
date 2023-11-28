import { css } from '@emotion/css';
import React from 'react';
import { Alert, useStyles2 } from '@grafana/ui/src';
import { AlertmanagerChoice } from '../../../../plugins/datasource/alertmanager/types';
import { alertmanagerApi } from '../api/alertmanagerApi';
import { GRAFANA_RULES_SOURCE_NAME } from '../utils/datasource';
export function GrafanaAlertmanagerDeliveryWarning({ currentAlertmanager }) {
    const styles = useStyles2(getStyles);
    const { useGetAlertmanagerChoiceStatusQuery } = alertmanagerApi;
    const { currentData: amChoiceStatus } = useGetAlertmanagerChoiceStatusQuery();
    const viewingInternalAM = currentAlertmanager === GRAFANA_RULES_SOURCE_NAME;
    const interactsWithExternalAMs = (amChoiceStatus === null || amChoiceStatus === void 0 ? void 0 : amChoiceStatus.alertmanagersChoice) &&
        [AlertmanagerChoice.External, AlertmanagerChoice.All].includes(amChoiceStatus === null || amChoiceStatus === void 0 ? void 0 : amChoiceStatus.alertmanagersChoice);
    if (!interactsWithExternalAMs || !viewingInternalAM) {
        return null;
    }
    const hasActiveExternalAMs = amChoiceStatus.numExternalAlertmanagers > 0;
    if (amChoiceStatus.alertmanagersChoice === AlertmanagerChoice.External) {
        return (React.createElement(Alert, { title: "Grafana alerts are not delivered to Grafana Alertmanager" },
            "Grafana is configured to send alerts to external Alertmanagers only. Changing Grafana Alertmanager configuration will not affect delivery of your alerts.",
            React.createElement("div", { className: styles.adminHint }, "To change your Alertmanager setup, go to the Alerting Admin page. If you do not have access, contact your Administrator.")));
    }
    if (amChoiceStatus.alertmanagersChoice === AlertmanagerChoice.All && hasActiveExternalAMs) {
        return (React.createElement(Alert, { title: "You have additional Alertmanagers to configure", severity: "warning" },
            "Ensure you make configuration changes in the correct Alertmanagers; both internal and external. Changing one will not affect the others.",
            React.createElement("div", { className: styles.adminHint }, "To change your Alertmanager setup, go to the Alerting Admin page. If you do not have access, contact your Administrator.")));
    }
    return null;
}
const getStyles = (theme) => ({
    adminHint: css `
    font-size: ${theme.typography.bodySmall.fontSize};
    font-weight: ${theme.typography.bodySmall.fontWeight};
  `,
});
//# sourceMappingURL=GrafanaAlertmanagerDeliveryWarning.js.map