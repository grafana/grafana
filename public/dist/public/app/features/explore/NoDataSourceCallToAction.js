import { __makeTemplateObject } from "tslib";
import React from 'react';
import { css } from '@emotion/css';
import { LinkButton, CallToActionCard, Icon, useTheme2 } from '@grafana/ui';
import { contextSrv } from 'app/core/core';
import { AccessControlAction } from 'app/types';
export var NoDataSourceCallToAction = function () {
    var theme = useTheme2();
    var canCreateDataSource = contextSrv.hasPermission(AccessControlAction.DataSourcesCreate) &&
        contextSrv.hasPermission(AccessControlAction.DataSourcesWrite);
    var message = 'Explore requires at least one data source. Once you have added a data source, you can query it here.';
    var footer = (React.createElement(React.Fragment, null,
        React.createElement(Icon, { name: "rocket" }),
        React.createElement(React.Fragment, null, " ProTip: You can also define data sources through configuration files. "),
        React.createElement("a", { href: "http://docs.grafana.org/administration/provisioning/#datasources?utm_source=explore", target: "_blank", rel: "noreferrer", className: "text-link" }, "Learn more")));
    var ctaElement = (React.createElement(LinkButton, { size: "lg", href: "datasources/new", icon: "database", disabled: !canCreateDataSource }, "Add data source"));
    var cardClassName = css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    max-width: ", "px;\n    margin-top: ", ";\n    align-self: center;\n  "], ["\n    max-width: ", "px;\n    margin-top: ", ";\n    align-self: center;\n  "])), theme.breakpoints.values.lg, theme.spacing(2));
    return (React.createElement(CallToActionCard, { callToActionElement: ctaElement, className: cardClassName, footer: footer, message: message }));
};
var templateObject_1;
//# sourceMappingURL=NoDataSourceCallToAction.js.map