import { css } from '@emotion/css';
import React, { useEffect, useState } from 'react';

import { DataSourceSettings, GrafanaTheme2 } from '@grafana/data';
import { Badge, InlineField, InlineSwitch, useStyles2 } from '@grafana/ui';

interface Props {
  dataSource: DataSourceSettings;
  dataSourcePluginName: string;
  isDefault: boolean;
  alertingSupported: boolean;
  onUpdate: (dataSource: DataSourceSettings) => Promise<DataSourceSettings>;
}

export function EditDataSourceSubtitle({
  dataSource,
  dataSourcePluginName,
  isDefault,
  alertingSupported,
  onUpdate,
}: Props) {
  const styles = useStyles2(getStyles);

  const [initialDataSource, setInitialDataSource] = useState<DataSourceSettings>(dataSource);

  const handleDefaultDataSourceChange = async (checked: boolean) => {
    try {
      await onUpdate({ ...initialDataSource, isDefault: checked });
    } catch (err) {
      return;
    }
  };

  // update this to read only initial dataSource load
  // currently it picks up dataSource updates from form
  useEffect(() => {
    setInitialDataSource(dataSource);
  }, [dataSource]);

  return (
    <div className={styles.subTitleRow}>
      <div className={styles.subTitleRowGroupFirst}>
        <div className={styles.subTitle}>
          Type: <span>{dataSourcePluginName}</span>
        </div>
        <InlineField
          htmlFor=""
          label="Default"
          tooltip="The default data source is preselected in new panels."
          transparent={true}
          labelWidth={8}
          disabled={false}
          className={styles.defaultDataSourceSwitchLabel}
        >
          <InlineSwitch
            id="basic-settings-default"
            transparent={true}
            value={isDefault}
            onChange={(evt: React.FormEvent<HTMLInputElement>) =>
              handleDefaultDataSourceChange(evt.currentTarget.checked)
            }
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
    defaultDataSourceSwitchLabel: css({
      margin: '0 0 0 0',
      svg: {
        marginLeft: '4px',
      },
    }),
  };
};
