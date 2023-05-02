import React, { useEffect, useState } from 'react';

import { DataSourceSettings } from '@grafana/data';
import { InlineSwitch } from '@grafana/ui';

interface Props {
  dataSource: DataSourceSettings;
  isDefault: boolean;
  onUpdate: (dataSource: DataSourceSettings) => Promise<DataSourceSettings>;
}

export function DataSourceDefaultSwitch({ dataSource, isDefault, onUpdate }: Props) {
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
    <InlineSwitch
      id="basic-settings-default"
      transparent={true}
      value={isDefault || false}
      onChange={(evt: React.FormEvent<HTMLInputElement>) => handleDefaultDataSourceChange(evt.currentTarget.checked)}
    />
  );
}
