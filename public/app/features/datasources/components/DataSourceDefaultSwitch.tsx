import { css } from '@emotion/css';
import React, { useEffect, useState } from 'react';

import { DataSourceSettings, GrafanaTheme2 } from '@grafana/data';
import { InlineSwitch, Tooltip, useStyles2 } from '@grafana/ui';

interface Props {
  dataSource: DataSourceSettings;
  isDefault: boolean;
  readOnly: boolean;
  onUpdate: (dataSource: DataSourceSettings) => Promise<DataSourceSettings>;
}

export function DataSourceDefaultSwitch({ dataSource, isDefault, readOnly, onUpdate }: Props) {
  const [initialDataSource, setInitialDataSource] = useState<DataSourceSettings>(dataSource);
  const styles = useStyles2(getStyles);

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

  if (readOnly) {
    return (
      <Tooltip
        placement="top"
        content="This data source was added by config and cannot be modified using the UI."
        theme="info"
      >
        <div className={styles.div}>
          <InlineSwitch
            id="basic-settings-default"
            transparent={true}
            value={isDefault || false}
            className={styles.switch}
            disabled={true}
          />
        </div>
      </Tooltip>
    );
  }

  return (
    <InlineSwitch
      id="basic-settings-default"
      transparent={true}
      value={isDefault || false}
      onChange={(evt: React.FormEvent<HTMLInputElement>) => handleDefaultDataSourceChange(evt.currentTarget.checked)}
      className={styles.switch}
      disabled={readOnly}
    />
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    div: css({
      div: {
        backgroundColor: 'transparent',
      },
    }),
    switch: css({
      padding: '0',
    }),
  };
};
