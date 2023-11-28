import { css } from '@emotion/css';
import cx from 'classnames';
import React from 'react';
import { selectors as e2eSelectors } from '@grafana/e2e-selectors/src';
import { Alert, useStyles2 } from '@grafana/ui/src';
const selectors = e2eSelectors.pages.ShareDashboardModal.PublicDashboard;
export const UnsupportedDataSourcesAlert = ({ unsupportedDataSources }) => {
    const styles = useStyles2(getStyles);
    return (React.createElement(Alert, { severity: "warning", title: "Unsupported data sources", "data-testid": selectors.UnsupportedDataSourcesWarningAlert, bottomSpacing: 0 },
        React.createElement("p", { className: styles.unsupportedDataSourceDescription },
            "There are data sources in this dashboard that are unsupported for public dashboards. Panels that use these data sources may not function properly: ",
            unsupportedDataSources,
            "."),
        React.createElement("a", { href: "https://grafana.com/docs/grafana/next/dashboards/dashboard-public/", className: cx('text-link', styles.unsupportedDataSourceDescription) }, "Read more about supported data sources")));
};
const getStyles = (theme) => ({
    unsupportedDataSourceDescription: css `
    color: ${theme.colors.text.secondary};
    margin-bottom: ${theme.spacing(1)};
  `,
});
//# sourceMappingURL=UnsupportedDataSourcesAlert.js.map