import { css } from '@emotion/css';
import * as React from 'react';

import { Trans, t } from '@grafana/i18n';
import { Field, Switch, TextLink, useTheme2 } from '@grafana/ui';

import { AzureMonitorDataSourceJsonData } from '../../types/types';

export interface Props {
  options: AzureMonitorDataSourceJsonData;
  onBasicLogsEnabledChange: (basicLogsEnabled: boolean) => void;
}

export const BasicLogsToggle = (props: Props) => {
  const { options, onBasicLogsEnabledChange } = props;

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
  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => onBasicLogsEnabledChange(e.target.checked);
  const description = (
    <p className={styles.text}>
      <Trans i18nKey="components.basic-logs-toggle.description-basic-logs">
        Enabling this feature incurs Azure Monitor per-query costs on dashboard panels that query tables configured for{' '}
        <TextLink
          href="https://learn.microsoft.com/en-us/azure/azure-monitor/logs/basic-logs-configure?tabs=portal-1"
          external
        >
          Basic Logs
        </TextLink>
        .
      </Trans>
    </p>
  );
  return (
    <Field
      description={description}
      label={t('components.basic-logs-toggle.label-enable-basic-logs', 'Enable Basic Logs')}
    >
      <div>
        <Switch
          aria-label={t('components.basic-logs-toggle.aria-label-enable-basic-logs', 'Basic Logs')}
          onChange={onChange}
          value={options.basicLogsEnabled ?? false}
        />
      </div>
    </Field>
  );
};
