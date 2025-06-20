import { ReactNode } from 'react';

import { LoadingPlaceholder } from '@grafana/ui';

import { ProvisionedDashboardData, useProvisionedDashboardData } from '../../saving/provisioned/hooks';
import { DashboardScene } from '../../scene/DashboardScene';

interface ProvisionedFormWrapperProps {
  dashboard: DashboardScene;
  fallback?: ReactNode;
  children: (
    data: Omit<ProvisionedDashboardData, 'defaultValues' | 'isReady'> & {
      defaultValues: NonNullable<ProvisionedDashboardData['defaultValues']>;
    }
  ) => ReactNode;
}

function isProvisionedDataReady(data: ProvisionedDashboardData): data is ProvisionedDashboardData & {
  defaultValues: NonNullable<ProvisionedDashboardData['defaultValues']>;
} {
  return data.isReady && data.defaultValues !== null;
}

export function ProvisionedFormWrapper({ dashboard, fallback, children }: ProvisionedFormWrapperProps) {
  const provisionedData = useProvisionedDashboardData(dashboard);

  if (!isProvisionedDataReady(provisionedData)) {
    return <>{fallback ?? <LoadingPlaceholder text="Loading provisioned dashboard data" />}</>;
  }

  // TypeScript now knows defaultValues is non-null
  return <>{children(provisionedData)}</>;
}
