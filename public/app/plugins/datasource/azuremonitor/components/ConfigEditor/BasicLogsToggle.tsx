import { css } from '@emotion/css';
import * as React from 'react';

import { Field, Switch, useTheme2 } from '@grafana/ui';

import { AzureMonitorDataSourceJsonData } from '../../types';

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
      Enabling this feature incurs Azure Monitor per-query costs on dashboard panels that query tables configured for{' '}
      <a
        href="https://learn.microsoft.com/en-us/azure/azure-monitor/logs/basic-logs-configure?tabs=portal-1"
        target="__blank"
        rel="noreferrer"
      >
        Basic Logs
      </a>
      .
    </p>
  );
  return (
    <Field description={description} label="Enable Basic Logs">
      <div>
        <Switch aria-label="Basic Logs" onChange={onChange} value={options.basicLogsEnabled ?? false} />
      </div>
    </Field>
  );
};
