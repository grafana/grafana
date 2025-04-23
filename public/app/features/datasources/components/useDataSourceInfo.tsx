import { Badge } from '@grafana/ui';
import { PageInfoItem } from 'app/core/components/Page/types';

import { t } from '../../../core/internationalization';

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
      <Badge
        color={alertingEnabled ? 'green' : 'red'}
        text={
          alertingEnabled
            ? t('datasources.use-data-source-info.badge-text-supported', 'Supported')
            : t('datasources.use-data-source-info.badge-text-not-supported', 'Not supported')
        }
      ></Badge>
    ),
  });

  return info;
};
