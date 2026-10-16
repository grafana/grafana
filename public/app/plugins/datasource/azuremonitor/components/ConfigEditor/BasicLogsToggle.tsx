import { css } from '@emotion/css';
import * as React from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Field, Switch, TextLink, useStyles2 } from '@grafana/ui';

import { type AzureMonitorDataSourceJsonData } from '../../types/types';

export interface Props {
  options: AzureMonitorDataSourceJsonData;
  onBasicLogsEnabledChange: (basicLogsEnabled: boolean) => void;
}

const getStyles = (theme: GrafanaTheme2) => ({
  description: css({
    ...theme.typography.bodySmall,
    color: theme.colors.text.secondary,
    fontSize: '12px',
    marginBottom: theme.spacing(1),
  }),
});

export const BasicLogsToggle = (props: Props) => {
  const { options, onBasicLogsEnabledChange } = props;

  const styles = useStyles2(getStyles);

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => onBasicLogsEnabledChange(e.target.checked);

  const description = (
    <p className={styles.description}>
      <Trans i18nKey="components.basic-logs-toggle.description-basic-logs">
        Enabling this feature incurs Azure Monitor per-query costs on dashboard panels that query tables configured for{' '}
        <TextLink
          href="https://learn.microsoft.com/en-us/azure/azure-monitor/logs/basic-logs-configure?tabs=portal-1"
          external
          variant="bodySmall"
        >
          Basic Logs
        </TextLink>
        .
      </Trans>
    </p>
  );

  return (
    <Field
      noMargin
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
