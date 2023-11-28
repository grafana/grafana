import { css } from '@emotion/css';
import React from 'react';
import { LinkButton, CallToActionCard, Icon, useTheme2 } from '@grafana/ui';
import { contextSrv } from 'app/core/core';
import { AccessControlAction } from 'app/types';
export const NoDataSourceCallToAction = () => {
    const theme = useTheme2();
    const canCreateDataSource = contextSrv.hasPermission(AccessControlAction.DataSourcesCreate) &&
        contextSrv.hasPermission(AccessControlAction.DataSourcesWrite);
    const message = 'Explore requires at least one data source. Once you have added a data source, you can query it here.';
    const footer = (React.createElement(React.Fragment, null,
        React.createElement(Icon, { name: "rocket" }),
        React.createElement(React.Fragment, null, " ProTip: You can also define data sources through configuration files. "),
        React.createElement("a", { href: "http://docs.grafana.org/administration/provisioning/?utm_source=explore#data-sources", target: "_blank", rel: "noreferrer", className: "text-link" }, "Learn more")));
    const ctaElement = (React.createElement(LinkButton, { size: "lg", href: "datasources/new", icon: "database", disabled: !canCreateDataSource }, "Add data source"));
    const cardClassName = css `
    max-width: ${theme.breakpoints.values.lg}px;
    margin-top: ${theme.spacing(2)};
    align-self: center;
  `;
    return (React.createElement(CallToActionCard, { callToActionElement: ctaElement, className: cardClassName, footer: footer, message: message }));
};
//# sourceMappingURL=NoDataSourceCallToAction.js.map