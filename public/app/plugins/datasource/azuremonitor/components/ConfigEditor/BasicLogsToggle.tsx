import { css } from '@emotion/css';
import React, { useState } from 'react';

import { ConfirmModal, Field, Switch, useTheme2 } from '@grafana/ui';

import { AzureDataSourceJsonData } from '../../types';

export interface Props {
  options: AzureDataSourceJsonData;
  onBasicLogsEnabledChange: (basicLogsEnabled: boolean) => void;
}

export const BasicLogsToggle = (props: Props) => {
  const { options, onBasicLogsEnabledChange } = props;
  const [basiclogsAckOpen, setBasicLogsAckOpen] = useState<boolean>(false);

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
  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onBasicLogsEnabledChange(e.target.checked);
    setBasicLogsAckOpen(e.target.checked);
  };
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
    <>
      <ConfirmModal
        isOpen={basiclogsAckOpen}
        title="Basic Logs Queries"
        body="Enabling this feature incurs Azure Monitor per-query cost on dashboard panels that use tables configured for Basic Logs. Please acknowledge this before continuing."
        confirmText="I Acknowledge"
        onConfirm={() => setBasicLogsAckOpen(false)}
        onDismiss={() => setBasicLogsAckOpen(false)}
      />
      <Field description={description} label="Enable Basic Logs">
        <div>
          <Switch aria-label="Basic Logs" onChange={onChange} value={options.basicLogsEnabled ?? false} />
        </div>
      </Field>
    </>
  );
};
