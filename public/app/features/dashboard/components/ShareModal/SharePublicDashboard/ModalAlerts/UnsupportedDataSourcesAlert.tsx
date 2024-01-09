import { css } from '@emotion/css';
import cx from 'classnames';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data/src';
import { selectors as e2eSelectors } from '@grafana/e2e-selectors/src';
import { Alert, useStyles2 } from '@grafana/ui/src';
import { Trans, t } from 'app/core/internationalization';

const selectors = e2eSelectors.pages.ShareDashboardModal.PublicDashboard;

export const UnsupportedDataSourcesAlert = ({ unsupportedDataSources }: { unsupportedDataSources: string }) => {
  const styles = useStyles2(getStyles);

  return (
    <Alert
      severity="warning"
      title={t('public-dashboard.modal-alerts.unsupported-data-source-alert-title', 'Unsupported data sources')}
      data-testid={selectors.UnsupportedDataSourcesWarningAlert}
      bottomSpacing={0}
    >
      <p className={styles.unsupportedDataSourceDescription}>
        <Trans i18nKey="public-dashboard.modal-alerts.unsupported-data-source-alert-desc">
          There are data sources in this dashboard that are unsupported for public dashboards. Panels that use these
          data sources may not function properly: {{ unsupportedDataSources }}.
        </Trans>
      </p>
      <a
        href="https://grafana.com/docs/grafana/next/dashboards/dashboard-public/"
        className={cx('text-link', styles.unsupportedDataSourceDescription)}
      >
        <Trans i18nKey="public-dashboard.modal-alerts.unsupport-data-source-alert-readmore-link">
          Read more about supported data sources
        </Trans>
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
