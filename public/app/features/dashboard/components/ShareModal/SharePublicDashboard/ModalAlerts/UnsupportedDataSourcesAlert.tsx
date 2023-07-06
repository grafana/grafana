import { css } from '@emotion/css';
import cx from 'classnames';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data/src';
import { selectors as e2eSelectors } from '@grafana/e2e-selectors/src';
import { Alert, useStyles2 } from '@grafana/ui/src';

const selectors = e2eSelectors.pages.ShareDashboardModal.PublicDashboard;

export const UnsupportedDataSourcesAlert = ({ unsupportedDataSources }: { unsupportedDataSources: string }) => {
  const styles = useStyles2(getStyles);

  return (
    <Alert
      severity="warning"
      title="Unsupported data sources"
      data-testid={selectors.UnsupportedDataSourcesWarningAlert}
    >
      <p className={styles.unsupportedDataSourceDescription}>
        There are data sources in this dashboard that are unsupported for public dashboards. Panels that use these data
        sources may not function properly: {unsupportedDataSources}.
      </p>
      <a
        href="https://grafana.com/docs/grafana/latest/dashboards/dashboard-public/"
        className={cx('text-link', styles.unsupportedDataSourceDescription)}
      >
        Read more about supported data sources
      </a>
    </Alert>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  unsupportedDataSourceDescription: css`
    color: ${theme.colors.text.secondary};
    margin-bottom: ${theme.spacing(1)};
  `,
});
