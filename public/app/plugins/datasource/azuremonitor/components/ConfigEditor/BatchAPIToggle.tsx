import { css } from '@emotion/css';
import * as React from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Field, Switch, TextLink, useStyles2 } from '@grafana/ui';

import { type AzureMonitorDataSourceJsonData } from '../../types/types';

export interface Props {
  options: AzureMonitorDataSourceJsonData;
  onBatchAPIEnabledChange: (batchAPIEnabled: boolean) => void;
}

const getStyles = (theme: GrafanaTheme2) => ({
  description: css({
    ...theme.typography.bodySmall,
    color: theme.colors.text.secondary,
    marginBottom: theme.spacing(1),
  }),
});

export const BatchAPIToggle = (props: Props) => {
  const { options, onBatchAPIEnabledChange } = props;

  const styles = useStyles2(getStyles);

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => onBatchAPIEnabledChange(e.target.checked);

  const description = (
    <p className={styles.description}>
      <Trans i18nKey="components.batch-api-toggle.description-batch-api">
        Queries multiple resources in a single request, improving performance for large dashboards. Requires the{' '}
        <TextLink
          href="https://learn.microsoft.com/en-us/azure/role-based-access-control/built-in-roles/monitor"
          external
          variant="bodySmall"
        >
          Monitoring Reader
        </TextLink>{' '}
        role at the subscription scope on{' '}
        <TextLink
          href="https://learn.microsoft.com/en-us/azure/azure-monitor/metrics/migrate-to-batch-api"
          external
          variant="bodySmall"
        >
          metrics.monitor.azure.com
        </TextLink>
        . Additional{' '}
        <TextLink href="https://azure.microsoft.com/en-us/pricing/details/monitor/" external variant="bodySmall">
          costs may apply
        </TextLink>{' '}
        beyond the free tier.
      </Trans>
    </p>
  );

  return (
    <Field
      noMargin
      description={description}
      label={t('components.batch-api-toggle.label-enable-batch-api', 'Enable Batch API')}
    >
      <div>
        <Switch
          aria-label={t('components.batch-api-toggle.aria-label-enable-batch-api', 'Batch API')}
          onChange={onChange}
          value={options.batchAPIEnabled ?? false}
        />
      </div>
    </Field>
  );
};
