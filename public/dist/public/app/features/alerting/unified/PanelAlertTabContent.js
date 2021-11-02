import { __makeTemplateObject } from "tslib";
import { css } from '@emotion/css';
import { Alert, CustomScrollbar, LoadingPlaceholder, useStyles2 } from '@grafana/ui';
import React from 'react';
import { NewRuleFromPanelButton } from './components/panel-alerts-tab/NewRuleFromPanelButton';
import { RulesTable } from './components/rules/RulesTable';
import { usePanelCombinedRules } from './hooks/usePanelCombinedRules';
import { selectors } from '@grafana/e2e-selectors';
export var PanelAlertTabContent = function (_a) {
    var dashboard = _a.dashboard, panel = _a.panel;
    var styles = useStyles2(getStyles);
    var _b = usePanelCombinedRules({
        dashboard: dashboard,
        panel: panel,
        poll: true,
    }), errors = _b.errors, loading = _b.loading, rules = _b.rules;
    var alert = errors.length ? (React.createElement(Alert, { title: "Errors loading rules", severity: "error" }, errors.map(function (error, index) { return (React.createElement("div", { key: index },
        "Failed to load Grafana rules state: ",
        error.message || 'Unknown error.')); }))) : null;
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
                !!dashboard.meta.canSave && (React.createElement(NewRuleFromPanelButton, { className: styles.newButton, panel: panel, dashboard: dashboard })))));
    }
    return (React.createElement("div", { "aria-label": selectors.components.PanelAlertTabContent.content, className: styles.noRulesWrapper },
        alert,
        !!dashboard.uid && (React.createElement(React.Fragment, null,
            React.createElement("p", null, "There are no alert rules linked to this panel."),
            !!dashboard.meta.canSave && React.createElement(NewRuleFromPanelButton, { panel: panel, dashboard: dashboard }))),
        !dashboard.uid && !!dashboard.meta.canSave && (React.createElement(Alert, { severity: "info", title: "Dashboard not saved" }, "Dashboard must be saved before alerts can be added."))));
};
var getStyles = function (theme) { return ({
    newButton: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    margin-top: ", ";\n  "], ["\n    margin-top: ", ";\n  "])), theme.spacing(3)),
    innerWrapper: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n    padding: ", ";\n  "], ["\n    padding: ", ";\n  "])), theme.spacing(2)),
    noRulesWrapper: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n    margin: ", ";\n    background-color: ", ";\n    padding: ", ";\n  "], ["\n    margin: ", ";\n    background-color: ", ";\n    padding: ", ";\n  "])), theme.spacing(2), theme.colors.background.secondary, theme.spacing(3)),
}); };
var templateObject_1, templateObject_2, templateObject_3;
//# sourceMappingURL=PanelAlertTabContent.js.map