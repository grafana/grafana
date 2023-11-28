import React from 'react';
import { Stack } from '@grafana/experimental';
import { Alert, LinkButton } from '@grafana/ui';
import { AlertmanagerAction, useAlertmanagerAbility } from '../../hooks/useAbilities';
import { GRAFANA_RULES_SOURCE_NAME, isVanillaPrometheusAlertManagerDataSource } from '../../utils/datasource';
import { makeAMLink } from '../../utils/misc';
import { Authorize } from '../Authorize';
import { ReceiversSection } from './ReceiversSection';
import { ReceiversTable } from './ReceiversTable';
import { TemplatesTable } from './TemplatesTable';
export const ReceiversAndTemplatesView = ({ config, alertManagerName }) => {
    const isGrafanaManagedAlertmanager = alertManagerName === GRAFANA_RULES_SOURCE_NAME;
    const isVanillaAM = isVanillaPrometheusAlertManagerDataSource(alertManagerName);
    return (React.createElement(Stack, { direction: "column", gap: 4 },
        React.createElement(ReceiversTable, { config: config, alertManagerName: alertManagerName }),
        !isVanillaAM && React.createElement(TemplatesView, { config: config, alertManagerName: alertManagerName }),
        !isGrafanaManagedAlertmanager && React.createElement(GlobalConfigAlert, { alertManagerName: alertManagerName })));
};
export const TemplatesView = ({ config, alertManagerName }) => {
    const [createNotificationTemplateSupported, createNotificationTemplateAllowed] = useAlertmanagerAbility(AlertmanagerAction.CreateNotificationTemplate);
    return (React.createElement(ReceiversSection, { title: "Notification templates", description: "Create notification templates to customize your notifications.", addButtonLabel: "Add template", addButtonTo: makeAMLink('/alerting/notifications/templates/new', alertManagerName), showButton: createNotificationTemplateSupported && createNotificationTemplateAllowed },
        React.createElement(TemplatesTable, { config: config, alertManagerName: alertManagerName })));
};
export const GlobalConfigAlert = ({ alertManagerName }) => {
    const isVanillaAM = isVanillaPrometheusAlertManagerDataSource(alertManagerName);
    return (React.createElement(Authorize, { actions: [AlertmanagerAction.UpdateExternalConfiguration] },
        React.createElement(Alert, { severity: "info", title: "Global config for contact points" },
            React.createElement("p", null, "For each external Alertmanager you can define global settings, like server addresses, usernames and password, for all the supported contact points."),
            React.createElement(LinkButton, { href: makeAMLink('alerting/notifications/global-config', alertManagerName), variant: "secondary" }, isVanillaAM ? 'View global config' : 'Edit global config'))));
};
//# sourceMappingURL=ReceiversAndTemplatesView.js.map