import { css } from '@emotion/css';
import * as React from 'react';

import { Trans, t } from '@grafana/i18n';
import { Field, Switch, TextLink, useTheme2 } from '@grafana/ui';

import { type AzureMonitorDataSourceJsonData } from '../../types/types';

export interface Props {
  options: AzureMonitorDataSourceJsonData;
  onAuxiliaryLogsEnabledChange: (auxiliaryLogsEnabled: boolean) => void;
}

export const AuxiliaryLogsToggle = (props: Props) => {
  const { options, onAuxiliaryLogsEnabledChange } = props;

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
  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => onAuxiliaryLogsEnabledChange(e.target.checked);
  const description = (
    <p className={styles.text}>
      <Trans i18nKey="components.auxiliary-logs-toggle.description-auxiliary-logs">
        Enabling this feature incurs Azure Monitor per-query costs on dashboard panels that query tables configured for{' '}
        <TextLink
          href="https://learn.microsoft.com/en-us/azure/azure-monitor/logs/data-platform-logs#table-plans"
          external
        >
          Auxiliary Logs
        </TextLink>
        . Auxiliary logs have no response time SLAs, are intended for ad-hoc queries and data exploration only, and
        should not be used for dashboards requiring real-time data or for alerting.
      </Trans>
    </p>
  );
  return (
    <Field
      description={description}
      label={t('components.auxiliary-logs-toggle.label-enable-auxiliary-logs', 'Enable Auxiliary Logs')}
    >
      <div>
        <Switch
          aria-label={t('components.auxiliary-logs-toggle.aria-label-enable-auxiliary-logs', 'Auxiliary Logs')}
          onChange={onChange}
          value={options.auxiliaryLogsEnabled ?? false}
        />
      </div>
    </Field>
  );
};
