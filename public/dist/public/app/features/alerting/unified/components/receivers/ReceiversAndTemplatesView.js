import { __makeTemplateObject } from "tslib";
import { css } from '@emotion/css';
import { Alert, LinkButton, useStyles2 } from '@grafana/ui';
import React from 'react';
import { GRAFANA_RULES_SOURCE_NAME, isVanillaPrometheusAlertManagerDataSource } from '../../utils/datasource';
import { makeAMLink } from '../../utils/misc';
import { ReceiversTable } from './ReceiversTable';
import { TemplatesTable } from './TemplatesTable';
export var ReceiversAndTemplatesView = function (_a) {
    var config = _a.config, alertManagerName = _a.alertManagerName;
    var isCloud = alertManagerName !== GRAFANA_RULES_SOURCE_NAME;
    var styles = useStyles2(getStyles);
    var isVanillaAM = isVanillaPrometheusAlertManagerDataSource(alertManagerName);
    return (React.createElement(React.Fragment, null,
        !isVanillaAM && React.createElement(TemplatesTable, { config: config, alertManagerName: alertManagerName }),
        React.createElement(ReceiversTable, { config: config, alertManagerName: alertManagerName }),
        isCloud && (React.createElement(Alert, { className: styles.section, severity: "info", title: "Global config for contact points" },
            React.createElement("p", null, "For each external Alertmanager you can define global settings, like server addresses, usernames and password, for all the supported contact points."),
            React.createElement(LinkButton, { href: makeAMLink('alerting/notifications/global-config', alertManagerName), variant: "secondary" }, isVanillaAM ? 'View global config' : 'Edit global config')))));
};
var getStyles = function (theme) { return ({
    section: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    margin-top: ", ";\n  "], ["\n    margin-top: ", ";\n  "])), theme.spacing(4)),
}); };
var templateObject_1;
//# sourceMappingURL=ReceiversAndTemplatesView.js.map