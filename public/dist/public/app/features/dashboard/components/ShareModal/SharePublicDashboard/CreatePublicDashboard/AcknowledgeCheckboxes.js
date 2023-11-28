import { css } from '@emotion/css';
import React from 'react';
import { selectors as e2eSelectors } from '@grafana/e2e-selectors/src';
import { Checkbox, FieldSet, HorizontalGroup, LinkButton, useStyles2, VerticalGroup } from '@grafana/ui/src';
const selectors = e2eSelectors.pages.ShareDashboardModal.PublicDashboard;
const ACKNOWLEDGES = [
    {
        type: 'publicAcknowledgment',
        description: 'Your entire dashboard will be public*',
        testId: selectors.WillBePublicCheckbox,
        info: {
            href: 'https://grafana.com/docs/grafana/latest/dashboards/dashboard-public/',
            tooltip: 'Learn more about public dashboards',
        },
    },
    {
        type: 'dataSourcesAcknowledgment',
        description: 'Publishing currently only works with a subset of data sources*',
        testId: selectors.LimitedDSCheckbox,
        info: {
            href: 'https://grafana.com/docs/grafana/latest/datasources/',
            tooltip: 'Learn more about public datasources',
        },
    },
    {
        type: 'usageAcknowledgment',
        description: 'Making a dashboard public will cause queries to run each time is viewed, which may increase costs*',
        testId: selectors.CostIncreaseCheckbox,
        info: {
            href: 'https://grafana.com/docs/grafana/latest/enterprise/query-caching/',
            tooltip: 'Learn more about query caching',
        },
    },
];
export const AcknowledgeCheckboxes = ({ disabled, register, }) => {
    const styles = useStyles2(getStyles);
    return (React.createElement(React.Fragment, null,
        React.createElement("p", { className: styles.title }, "Before you make the dashboard public, acknowledge the following:"),
        React.createElement(FieldSet, { disabled: disabled },
            React.createElement(VerticalGroup, { spacing: "md" }, ACKNOWLEDGES.map((acknowledge) => (React.createElement(HorizontalGroup, { key: acknowledge.type, spacing: "none", align: "center" },
                React.createElement(Checkbox, Object.assign({}, register(acknowledge.type, { required: true }), { label: acknowledge.description, "data-testid": acknowledge.testId })),
                React.createElement(LinkButton, { variant: "primary", href: acknowledge.info.href, target: "_blank", fill: "text", icon: "info-circle", rel: "noopener noreferrer", tooltip: acknowledge.info.tooltip }))))))));
};
const getStyles = (theme) => ({
    title: css `
    font-weight: ${theme.typography.fontWeightBold};
  `,
});
//# sourceMappingURL=AcknowledgeCheckboxes.js.map