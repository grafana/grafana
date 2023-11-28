import React from 'react';
import { useLocation } from 'react-router-dom';
import { useAsync } from 'react-use';
import { urlUtil } from '@grafana/data';
import { logInfo } from '@grafana/runtime';
import { Alert, Button, LinkButton } from '@grafana/ui';
import { useSelector } from 'app/types';
import { LogMessages } from '../../Analytics';
import { panelToRuleFormValues } from '../../utils/rule-form';
export const NewRuleFromPanelButton = ({ dashboard, panel, className }) => {
    const templating = useSelector((state) => {
        return state.templating;
    });
    const location = useLocation();
    const { loading, value: formValues } = useAsync(() => panelToRuleFormValues(panel, dashboard), 
    // Templating variables are required to update formValues on each variable's change. It's used implicitly by the templating engine
    [panel, dashboard, templating]);
    if (loading) {
        return React.createElement(Button, { disabled: true }, "Create alert rule from this panel");
    }
    if (!formValues) {
        return (React.createElement(Alert, { severity: "info", title: "No alerting capable query found" }, "Cannot create alerts from this panel because no query to an alerting capable datasource is found."));
    }
    const ruleFormUrl = urlUtil.renderUrl('alerting/new', {
        defaults: JSON.stringify(formValues),
        returnTo: location.pathname + location.search,
    });
    return (React.createElement(LinkButton, { icon: "bell", onClick: () => logInfo(LogMessages.alertRuleFromPanel), href: ruleFormUrl, className: className, "data-testid": "create-alert-rule-button" }, "Create alert rule from this panel"));
};
//# sourceMappingURL=NewRuleFromPanelButton.js.map