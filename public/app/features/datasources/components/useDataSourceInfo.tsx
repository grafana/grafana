import { t } from '@grafana/i18n';
import { Badge } from '@grafana/ui';
import { type PageInfoItem } from 'app/core/components/Page/types';

import { isAdvisorEnabled, type DatasourceFailureDetails } from '../../connections/hooks/useDatasourceAdvisorChecks';

import { DataSourceFailureBadge } from './DataSourceFailureBadge';

type DataSourceInfo = {
  dataSourcePluginName: string;
  alertingSupported: boolean;
  failure?: DatasourceFailureDetails;
};

export const useDataSourceInfo = (dataSourceInfo: DataSourceInfo): PageInfoItem[] => {
  const info: PageInfoItem[] = [];
  const alertingEnabled = dataSourceInfo.alertingSupported;
  const failureSeverity = dataSourceInfo.failure?.severity;

  if (!dataSourceInfo.dataSourcePluginName) {
    return info;
  }

  info.push({
    label: t('datasources.use-data-source-info.label.type', 'Type'),
    value: dataSourceInfo.dataSourcePluginName,
  });

  info.push({
    label: t('datasources.use-data-source-info.label.alerting', 'Alerting'),
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

  if (isAdvisorEnabled()) {
    info.push({
      label: t('datasources.use-data-source-info.label.advisor', 'Advisor'),
      value: failureSeverity ? (
        <DataSourceFailureBadge severity={failureSeverity} message={dataSourceInfo.failure?.message} />
      ) : (
        <Badge color="green" text={t('datasources.use-data-source-info.badge-text-success', 'Success')} />
      ),
    });
  }

  return info;
};
