import { css } from '@emotion/css';
import * as React from 'react';

import { Trans, t } from '@grafana/i18n';
import { Field, Switch, TextLink, useTheme2 } from '@grafana/ui';

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
  };

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => onBatchAPIEnabledChange(e.target.checked);

  const description = (
    <p className={styles.text}>
      <Trans i18nKey="components.batch-api-toggle.description-batch-api">
        Queries multiple resources in a single request, improving performance for large dashboards. Requires{' '}
        <TextLink
          href="https://learn.microsoft.com/en-us/azure/azure-monitor/essentials/rest-api-walkthrough#retrieve-metric-values-multi-dimensional-api"
          external
        >
          Monitoring Reader
        </TextLink>{' '}
        at the subscription scope on{' '}
        <TextLink href="https://learn.microsoft.com/en-us/azure/azure-monitor/metrics/migrate-to-batch-api" external>
          metrics.monitor.azure.com
        </TextLink>
        . After 1,000,000 free API calls per month, additional calls cost $0.01 per 1,000.
      </Trans>
    </p>
  );

  return (
    <Field
      noMargin
      description={description}
      label={t('components.batch-api-toggle.label-enable-batch-api', 'Enable Batch API')}
    >
      <Switch
        aria-label={t('components.batch-api-toggle.aria-label-enable-batch-api', 'Batch API')}
        onChange={onChange}
        value={options.batchAPIEnabled ?? false}
      />
    </Field>
  );
};
