import React from 'react';
import { Alert, LinkButton, Button } from '@grafana/ui';
import { panelToRuleFormValues } from '../../utils/rule-form';
import { useLocation } from 'react-router-dom';
import { urlUtil } from '@grafana/data';
import { useAsync } from 'react-use';
export var NewRuleFromPanelButton = function (_a) {
    var dashboard = _a.dashboard, panel = _a.panel, className = _a.className;
    var _b = useAsync(function () { return panelToRuleFormValues(panel, dashboard); }, [panel, dashboard]), loading = _b.loading, formValues = _b.value;
    var location = useLocation();
    if (loading) {
        return React.createElement(Button, { disabled: true }, "Create alert rule from this panel");
    }
    if (!formValues) {
        return (React.createElement(Alert, { severity: "info", title: "No alerting capable query found" }, "Cannot create alerts from this panel because no query to an alerting capable datasource is found."));
    }
    var ruleFormUrl = urlUtil.renderUrl('alerting/new', {
        defaults: JSON.stringify(formValues),
        returnTo: location.pathname + location.search,
    });
    return (React.createElement(LinkButton, { icon: "bell", href: ruleFormUrl, className: className, "data-testid": "create-alert-rule-button" }, "Create alert rule from this panel"));
};
//# sourceMappingURL=NewRuleFromPanelButton.js.map