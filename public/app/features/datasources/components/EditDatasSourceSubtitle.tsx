import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Badge, InlineField, InlineSwitch, useStyles2 } from '@grafana/ui';

interface Props {
  dataSourcePluginName: string;
  isDefault: boolean;
  alertingSupported: boolean;
  onDefaultChange: (value: boolean) => void;
}

export function EditDataSourceSubtitle({ dataSourcePluginName, isDefault, alertingSupported, onDefaultChange }: Props) {
  const styles = useStyles2(getStyles);
  return (
    <div className={styles.subTitleRow}>
      <div className={styles.subTitleRowGroupFirst}>
        <div className={styles.subTitle}>
          Type: <span>{dataSourcePluginName}</span>
        </div>
        <InlineField
          label="Default"
          tooltip="This datasource is used when you select the data source in panels. The default data source is
        'preselected in new panels."
          transparent={true}
          labelWidth={8}
          disabled={false}
          className={styles.defaultDataSourceSwitch}
        >
          <InlineSwitch
            id="basic-settings-default"
            transparent={true}
            value={isDefault}
            onChange={(event: React.FormEvent<HTMLInputElement>) => onDefaultChange(event.currentTarget.checked)}
          />
        </InlineField>
      </div>
      {alertingSupported ? (
        <Badge color="green" icon="check-circle" text="Alerting supported" />
      ) : (
        <Badge color="orange" icon="exclamation-triangle" text="Alerting not supported" />
      )}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    subTitleRow: css({
      alignItems: 'center',
      display: 'flex',
      flexDirection: 'row',
      flexWrap: 'wrap',
    }),
    subTitleRowGroupFirst: css({
      alignItems: 'center',
      display: 'flex',
      flexDirection: 'row',
      justifyContent: 'center',
      marginRight: theme.spacing(30),
    }),
    subTitle: css({
      position: 'relative',
      color: theme.colors.text.secondary,
      span: {
        color: theme.colors.text.primary,
      },
      marginRight: theme.spacing(1),
    }),
    defaultDataSourceSwitch: css({
      margin: '0 0 0 0',
    }),
  };
};
