import { t } from '@grafana/i18n';
import { Badge } from '@grafana/ui';
import { type PageInfoItem } from 'app/core/components/Page/types';
import { ManagedBadge } from 'app/features/provisioning/components/ManagedBadge';
import {
  getManagerIdentity,
  getManagerKind,
  getSourcePath,
  isManaged,
  type ManagedResource,
} from 'app/features/provisioning/utils/managedResource';

import { type DatasourceFailureDetails } from '../../connections/hooks/useDatasourceAdvisorChecks';

import { DataSourceFailureBadge } from './DataSourceFailureBadge';

type DataSourceInfo = {
  dataSourcePluginName: string;
  alertingSupported: boolean;
  // while true, alertingSupported is not known yet and the badge is not rendered
  alertingLoading?: boolean;
  failure?: DatasourceFailureDetails;
  // whether advisor has produced a completed check for this datasource
  advisorChecked?: boolean;
  // the stored Kubernetes object, when it is managed; its annotations drive the provisioning badge
  managedResource?: ManagedResource;
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

  if (!dataSourceInfo.alertingLoading) {
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
  }

  const managedResource = dataSourceInfo.managedResource;
  if (managedResource && isManaged(managedResource)) {
    info.push({
      label: t('datasources.use-data-source-info.label.managed-by', 'Managed by'),
      value: (
        <ManagedBadge
          managerKind={getManagerKind(managedResource)}
          name={getManagerIdentity(managedResource)}
          repositoryName={getManagerIdentity(managedResource)}
          sourcePath={getSourcePath(managedResource)}
        />
      ),
    });
  }

  if (dataSourceInfo.advisorChecked) {
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
