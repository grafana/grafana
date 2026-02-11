import { config } from '@grafana/runtime';

import { BasicProvisionedDashboardsEmptyPage } from '../DashboardLibrary/BasicProvisionedDashboardsEmptyPage';
import { SuggestedDashboards } from '../DashboardLibrary/SuggestedDashboards';

interface DashboardEmptyExtensionsProps {
  dashboardLibraryDatasourceUid: string | null;
}

export const DashboardEmptyExtensions = ({ dashboardLibraryDatasourceUid }: DashboardEmptyExtensionsProps) => (
  <>
    {/* Suggested Dashboards Section */}
    {config.featureToggles.suggestedDashboards &&
      config.featureToggles.dashboardLibrary &&
      dashboardLibraryDatasourceUid && <SuggestedDashboards datasourceUid={dashboardLibraryDatasourceUid} />}

    {/* Basic Provisioned Dashboards Section that don't include community dashboards */}
    {config.featureToggles.dashboardLibrary &&
      !config.featureToggles.suggestedDashboards &&
      dashboardLibraryDatasourceUid && (
        <BasicProvisionedDashboardsEmptyPage datasourceUid={dashboardLibraryDatasourceUid} />
      )}
  </>
);
