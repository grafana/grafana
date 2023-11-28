import { css } from '@emotion/css';
import React from 'react';
import { selectors } from '@grafana/e2e-selectors';
import { Alert, CustomScrollbar, LoadingPlaceholder, useStyles2 } from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';
import { NewRuleFromPanelButton } from './components/panel-alerts-tab/NewRuleFromPanelButton';
import { RulesTable } from './components/rules/RulesTable';
import { usePanelCombinedRules } from './hooks/usePanelCombinedRules';
import { getRulesPermissions } from './utils/access-control';
export const PanelAlertTabContent = ({ dashboard, panel }) => {
    const styles = useStyles2(getStyles);
    const { errors, loading, rules } = usePanelCombinedRules({
        dashboard,
        panel,
        poll: true,
    });
    const permissions = getRulesPermissions('grafana');
    const canCreateRules = contextSrv.hasPermission(permissions.create);
    const alert = errors.length ? (React.createElement(Alert, { title: "Errors loading rules", severity: "error" }, errors.map((error, index) => (React.createElement("div", { key: index },
        "Failed to load Grafana rules state: ",
        error.message || 'Unknown error.'))))) : null;
    if (loading && !rules.length) {
        return (React.createElement("div", { className: styles.innerWrapper },
            alert,
            React.createElement(LoadingPlaceholder, { text: "Loading rules..." })));
    }
    if (rules.length) {
        return (React.createElement(CustomScrollbar, { autoHeightMin: "100%" },
            React.createElement("div", { className: styles.innerWrapper },
                alert,
                React.createElement(RulesTable, { rules: rules }),
                !!dashboard.meta.canSave && canCreateRules && (React.createElement(NewRuleFromPanelButton, { className: styles.newButton, panel: panel, dashboard: dashboard })))));
    }
    return (React.createElement("div", { "aria-label": selectors.components.PanelAlertTabContent.content, className: styles.noRulesWrapper },
        alert,
        !!dashboard.uid && (React.createElement(React.Fragment, null,
            React.createElement("p", null, "There are no alert rules linked to this panel."),
            !!dashboard.meta.canSave && canCreateRules && React.createElement(NewRuleFromPanelButton, { panel: panel, dashboard: dashboard }))),
        !dashboard.uid && !!dashboard.meta.canSave && (React.createElement(Alert, { severity: "info", title: "Dashboard not saved" }, "Dashboard must be saved before alerts can be added."))));
};
const getStyles = (theme) => ({
    newButton: css `
    margin-top: ${theme.spacing(3)};
  `,
    innerWrapper: css `
    padding: ${theme.spacing(2)};
  `,
    noRulesWrapper: css `
    margin: ${theme.spacing(2)};
    background-color: ${theme.colors.background.secondary};
    padding: ${theme.spacing(3)};
  `,
});
//# sourceMappingURL=PanelAlertTabContent.js.map