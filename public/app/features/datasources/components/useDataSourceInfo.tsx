import React from 'react';

import { Badge } from '@grafana/ui';
import { PageInfoItem } from 'app/core/components/Page/types';

type DataSourceInfo = {
  dataSourcePluginName: string;
  alertingSupported: boolean;
};

export const useDataSourceInfo = (dataSourceInfo: DataSourceInfo): PageInfoItem[] => {
  const info: PageInfoItem[] = [];
  const alertingEnabled = dataSourceInfo.alertingSupported;

  info.push({
    label: 'Type',
    value: dataSourceInfo.dataSourcePluginName,
  });

  info.push({
    label: 'Alerting',
    value: (
      <Badge color={alertingEnabled ? 'green' : 'red'} text={alertingEnabled ? 'Supported' : 'Not supported'}></Badge>
    ),
  });

  return info;
};
