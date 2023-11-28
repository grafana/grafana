import { css } from '@emotion/css';
import { capitalize } from 'lodash';
import React from 'react';
import { Badge, CallToActionCard, Card, Icon, LinkButton, Tooltip, useStyles2 } from '@grafana/ui';
import { makeDataSourceLink } from '../../utils/misc';
export function ExternalAlertmanagerDataSources({ alertmanagers, inactive }) {
    const styles = useStyles2(getStyles);
    return (React.createElement(React.Fragment, null,
        React.createElement("h5", null, "Alertmanagers Receiving Grafana-managed alerts"),
        React.createElement("div", { className: styles.muted },
            "Alertmanager data sources support a configuration setting that allows you to choose to send Grafana-managed alerts to that Alertmanager. ",
            React.createElement("br", null),
            "Below, you can see the list of all Alertmanager data sources that have this setting enabled."),
        alertmanagers.length === 0 && (React.createElement(CallToActionCard, { message: React.createElement("div", null,
                "There are no Alertmanager data sources configured to receive Grafana-managed alerts. ",
                React.createElement("br", null),
                "You can change this by selecting Receive Grafana Alerts in a data source configuration."), callToActionElement: React.createElement(LinkButton, { href: "/datasources" }, "Go to data sources"), className: styles.externalDsCTA })),
        alertmanagers.length > 0 && (React.createElement("div", { className: styles.externalDs }, alertmanagers.map((am) => (React.createElement(ExternalAMdataSourceCard, { key: am.dataSource.uid, alertmanager: am, inactive: inactive })))))));
}
export function ExternalAMdataSourceCard({ alertmanager, inactive }) {
    const styles = useStyles2(getStyles);
    const { dataSource, status, statusInconclusive, url } = alertmanager;
    return (React.createElement(Card, null,
        React.createElement(Card.Heading, { className: styles.externalHeading },
            dataSource.name,
            ' ',
            statusInconclusive && (React.createElement(Tooltip, { content: "Multiple Alertmanagers have the same URL configured. The state might be inconclusive." },
                React.createElement(Icon, { name: "exclamation-triangle", size: "md", className: styles.externalWarningIcon })))),
        React.createElement(Card.Figure, null,
            React.createElement("img", { src: "public/app/plugins/datasource/alertmanager/img/logo.svg", alt: "", height: "40px", width: "40px", style: { objectFit: 'contain' } })),
        React.createElement(Card.Tags, null, inactive ? (React.createElement(Badge, { text: "Inactive", color: "red", tooltip: "Grafana is configured to send alerts to the built-in internal Alertmanager only. External Alertmanagers do not receive any alerts." })) : (React.createElement(Badge, { text: capitalize(status), color: status === 'dropped' ? 'red' : status === 'active' ? 'green' : 'orange' }))),
        React.createElement(Card.Meta, null, url),
        React.createElement(Card.Actions, null,
            React.createElement(LinkButton, { href: makeDataSourceLink(dataSource), size: "sm", variant: "secondary" }, "Go to datasource"))));
}
export const getStyles = (theme) => ({
    muted: css `
    font-size: ${theme.typography.bodySmall.fontSize};
    line-height: ${theme.typography.bodySmall.lineHeight};
    color: ${theme.colors.text.secondary};
  `,
    externalHeading: css `
    justify-content: flex-start;
  `,
    externalWarningIcon: css `
    margin: ${theme.spacing(0, 1)};
    fill: ${theme.colors.warning.main};
  `,
    externalDs: css `
    display: grid;
    gap: ${theme.spacing(1)};
    padding: ${theme.spacing(2, 0)};
  `,
    externalDsCTA: css `
    margin: ${theme.spacing(2, 0)};
  `,
});
//# sourceMappingURL=ExternalAlertmanagerDataSources.js.map