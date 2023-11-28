import React from 'react';
import { useLocation } from 'react-router-dom';
import { useToggle } from 'react-use';
import { urlUtil } from '@grafana/data';
import { Button, Dropdown, Icon, LinkButton, Menu, MenuItem } from '@grafana/ui';
import { logInfo, LogMessages } from './Analytics';
import { GrafanaRulesExporter } from './components/export/GrafanaRulesExporter';
import { AlertSourceAction, useAlertSourceAbility } from './hooks/useAbilities';
export function MoreActionsRuleButtons({}) {
    const [_, viewRuleAllowed] = useAlertSourceAbility(AlertSourceAction.ViewAlertRule);
    const [createRuleSupported, createRuleAllowed] = useAlertSourceAbility(AlertSourceAction.CreateAlertRule);
    const [createCloudRuleSupported, createCloudRuleAllowed] = useAlertSourceAbility(AlertSourceAction.CreateExternalAlertRule);
    const canCreateGrafanaRules = createRuleSupported && createRuleAllowed;
    const canCreateCloudRules = createCloudRuleSupported && createCloudRuleAllowed;
    const location = useLocation();
    const [showExportDrawer, toggleShowExportDrawer] = useToggle(false);
    const newMenu = (React.createElement(Menu, null,
        (canCreateGrafanaRules || canCreateCloudRules) && (React.createElement(MenuItem, { url: urlUtil.renderUrl(`alerting/new/recording`, {
                returnTo: location.pathname + location.search,
            }), label: "New recording rule" })),
        viewRuleAllowed && React.createElement(MenuItem, { onClick: toggleShowExportDrawer, label: "Export all Grafana-managed rules" })));
    return (React.createElement(React.Fragment, null,
        (canCreateGrafanaRules || canCreateCloudRules) && (React.createElement(LinkButton, { href: urlUtil.renderUrl('alerting/new/alerting', { returnTo: location.pathname + location.search }), icon: "plus", onClick: () => logInfo(LogMessages.alertRuleFromScratch) }, "New alert rule")),
        React.createElement(Dropdown, { overlay: newMenu },
            React.createElement(Button, { variant: "secondary" },
                "More",
                React.createElement(Icon, { name: "angle-down" }))),
        showExportDrawer && React.createElement(GrafanaRulesExporter, { onClose: toggleShowExportDrawer })));
}
//# sourceMappingURL=MoreActionsRuleButtons.js.map