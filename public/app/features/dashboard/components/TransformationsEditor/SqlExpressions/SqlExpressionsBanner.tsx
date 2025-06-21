import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Alert, TextLink, useStyles2 } from '@grafana/ui';
import { LocalStorageValueProvider } from 'app/core/components/LocalStorageValueProvider';

const LOCAL_STORAGE_KEY = 'dashboard.sql-expressions-banner.dismissed';

export function SqlExpressionsBanner() {
  const styles = useStyles2(getStyles);

  return (
    <LocalStorageValueProvider<boolean> storageKey={LOCAL_STORAGE_KEY} defaultValue={false}>
      {(isDismissed, onDismiss) => {
        if (isDismissed) {
          return null;
        }
        return (
          <Alert
            title={t('dashboard.transformation-picker-ng.sql-expressions-title', 'SQL Expressions')}
            severity="info"
            onRemove={() => onDismiss(true)}
          >
            <div className={styles.sqlExpressionsMessage}>
              <Trans i18nKey="dashboard.transformation-picker-ng.sql-expressions-message-description">
                A new way to manipulate and transform the results of data source queries using MySQL-like syntax.
              </Trans>
              <TextLink
                href="https://grafana.com/docs/grafana/latest/panels-visualizations/query-transform-data/sql-expressions/"
                external
              >
                <Trans i18nKey="dashboard.transformation-picker-ng.sql-expressions-message-link">Learn more</Trans>
              </TextLink>
            </div>
          </Alert>
        );
      }}
    </LocalStorageValueProvider>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    sqlExpressionsMessage: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(1),
    }),
  };
};
