import React from 'react';

import { Badge } from '@grafana/ui';
import { PageInfoItem } from 'app/core/components/Page/types';

import { DataSourceInfo } from '../types';

import { DataSourceDefaultSwitch } from './DataSourceDefaultSwitch';

export const useDataSourceInfo = (dataSourceInfo: DataSourceInfo): PageInfoItem[] => {
  const info: PageInfoItem[] = [];
  const alertingEnabled = dataSourceInfo.alertingSupported;

  info.push({
    label: 'Type',
    value: dataSourceInfo.dataSourcePluginName,
  });

  info.push({
    label: 'Default',
    value: (
      <DataSourceDefaultSwitch
        dataSource={dataSourceInfo.dataSource}
        isDefault={dataSourceInfo.isDefault}
        onUpdate={dataSourceInfo.onUpdate}
      ></DataSourceDefaultSwitch>
    ),
  });

  info.push({
    label: 'Alerting',
    value: (
      <Badge color={alertingEnabled ? 'green' : 'red'} text={alertingEnabled ? 'Supported' : 'Not supported'}></Badge>
    ),
  });

  return info;
};
