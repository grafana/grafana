import { css } from '@emotion/css';
import * as React from 'react';

import { Trans, t } from '@grafana/i18n';
import { Alert, Field, Switch, TextLink, useTheme2 } from '@grafana/ui';

import { AzureMonitorDataSourceJsonData } from '../../types/types';

export interface Props {
  options: AzureMonitorDataSourceJsonData;
  onBatchAPIEnabledChange: (batchAPIEnabled: boolean) => void;
}

export const BatchAPIToggle = (props: Props) => {
  const { options, onBatchAPIEnabledChange } = props;

  const theme = useTheme2();
  const styles = {
    text: css({
      ...theme.typography.body,
      color: theme.colors.text.secondary,
      fontSize: '11px',
      a: css({
        color: theme.colors.text.link,
        textDecoration: 'underline',
        '&:hover': {
          textDecoration: 'none',
        },
      }),
    }),
    alert: css({
      marginTop: '8px',
      marginBottom: '8px',
    }),
  };
  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => onBatchAPIEnabledChange(e.target.checked);
  const description = (
    <div>
      <p className={styles.text}>
        <Trans i18nKey="components.batch-api-toggle.description-batch-api">
          Enable the{' '}
          <TextLink href="https://learn.microsoft.com/azure/azure-monitor/metrics/migrate-to-batch-api" external>
            Azure Monitor Metrics Batch API
          </TextLink>{' '}
          to improve query performance when fetching metrics from multiple resources. This reduces API calls by batching
          up to 50 resources per request.
        </Trans>
      </p>
      {options.batchAPIEnabled && (
        <Alert
          severity="info"
          title={t('components.batch-api-toggle.alert-title-requirements', 'Additional Requirements')}
          className={styles.alert}
        >
          <p>
            <Trans i18nKey="components.batch-api-toggle.alert-permissions">
              <strong>Permissions:</strong> Requires subscription-level read permissions. Ensure your service principal
              or managed identity has the &quot;Monitoring Reader&quot; role at the subscription level.
            </Trans>
          </p>
          <p>
            <Trans i18nKey="components.batch-api-toggle.alert-costs">
              <strong>Costs:</strong> The Batch API incurs $0.01 per 1,000 API calls after the first 1,000,000 free
              calls per month per subscription.{' '}
              <TextLink
                href="https://learn.microsoft.com/azure/azure-monitor/data-collection/data-plane-versus-metrics-export"
                external
              >
                Learn more
              </TextLink>
            </Trans>
          </p>
        </Alert>
      )}
    </div>
  );
  return (
    <Field
      description={description}
      label={t('components.batch-api-toggle.label-enable-batch-api', 'Enable Metrics Batch API (Experimental)')}
    >
      <div>
        <Switch
          aria-label={t('components.batch-api-toggle.aria-label-enable-batch-api', 'Metrics Batch API')}
          onChange={onChange}
          value={options.batchAPIEnabled ?? false}
        />
      </div>
    </Field>
  );
};
