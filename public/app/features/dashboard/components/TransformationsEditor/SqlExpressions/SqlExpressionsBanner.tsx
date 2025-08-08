import { LocalStorageValueProvider } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Alert, Stack, TextLink } from '@grafana/ui';

const LOCAL_STORAGE_KEY = 'dashboard.sql-expressions-banner.dismissed';

export const SqlExpressionsBanner = () => (
  <LocalStorageValueProvider<boolean> storageKey={LOCAL_STORAGE_KEY} defaultValue={false}>
    {(isDismissed, onDismiss) => {
      if (isDismissed) {
        return null;
      }
      return (
        <Alert
          bottomSpacing={1}
          title={t('dashboard.transformation-picker-ng.sql-expressions-title', 'SQL Expressions')}
          severity="info"
          onRemove={() => onDismiss(true)}
        >
          <Stack direction="column" gap={1}>
            <Trans i18nKey="dashboard.transformation-picker-ng.sql-expressions-message-description">
              A new way to manipulate and transform the results of data source queries using MySQL-like syntax.
            </Trans>
            <TextLink
              href="https://grafana.com/docs/grafana/latest/panels-visualizations/query-transform-data/sql-expressions/"
              external
            >
              <Trans i18nKey="dashboard.transformation-picker-ng.sql-expressions-message-link">Learn more</Trans>
            </TextLink>
          </Stack>
        </Alert>
      );
    }}
  </LocalStorageValueProvider>
);
