import { Grid } from '@grafana/ui';
import { type PluginDashboard } from 'app/types/plugins';

import { type CompatibilityState } from '../CompatibilityBadge';
import { DashboardCard } from '../DashboardCard';
import { PAGE_SIZE } from '../constants';
import { type GnetDashboard, isGnetDashboard } from '../types';
import { getThumbnailUrl, getLogoUrl, buildDashboardDetails } from '../utils/communityDashboardHelpers';
import { getProvisionedDashboardImageUrl } from '../utils/provisionedDashboardHelpers';

interface DashboardResultsGridProps {
  provisionedSlice: PluginDashboard[];
  communitySlice: GnetDashboard[];
  currentPage: number;
  datasourceType: string;
  datasourceUid?: string;
  isCompatibilityAppEnabled: boolean | undefined;
  compatibilityMap: Map<number, CompatibilityState>;
  showAssistantButton?: boolean;
  onClickProvisionedDashboard: (dashboard: PluginDashboard, customizeWithAssistant?: boolean) => void;
  onClickCommunityDashboard: (dashboard: GnetDashboard, customizeWithAssistant?: boolean) => void;
  onCheckCompatibility: (dashboard: GnetDashboard, triggerMethod: 'manual' | 'auto_initial_load') => void;
}

export const DashboardResultsGrid = ({
  provisionedSlice,
  communitySlice,
  currentPage,
  datasourceType,
  datasourceUid,
  isCompatibilityAppEnabled,
  compatibilityMap,
  showAssistantButton,
  onClickProvisionedDashboard,
  onClickCommunityDashboard,
  onCheckCompatibility,
}: DashboardResultsGridProps) => (
  <Grid gap={4} columns={{ xs: 1, lg: 3 }} alignItems="start">
    {provisionedSlice.map((dashboard, index) => {
      const globalIndex = (currentPage - 1) * PAGE_SIZE + index;
      const imageUrl = getProvisionedDashboardImageUrl(globalIndex);

      return (
        <DashboardCard
          key={`prov-${dashboard.uid}`}
          title={dashboard.title}
          imageUrl={imageUrl}
          dashboard={dashboard}
          onClick={(customizeWithAssistant) => onClickProvisionedDashboard(dashboard, customizeWithAssistant)}
          kind="suggested_dashboard"
          showAssistantButton={showAssistantButton}
          showDatasourceProvidedBadge
        />
      );
    })}
    {communitySlice.map((dashboard) => {
      const thumbnailUrl = getThumbnailUrl(dashboard);
      const logoUrl = getLogoUrl(dashboard);
      const imageUrl = thumbnailUrl || logoUrl;
      const isLogo = !thumbnailUrl;
      const details = buildDashboardDetails(dashboard);

      const showCompatBadge = isCompatibilityAppEnabled && !!datasourceUid && datasourceType === 'prometheus';

      const onCompatibilityCheck =
        showCompatBadge && isGnetDashboard(dashboard) ? () => onCheckCompatibility(dashboard, 'manual') : undefined;

      return (
        <DashboardCard
          key={`comm-${dashboard.id}`}
          title={dashboard.name}
          imageUrl={imageUrl}
          dashboard={dashboard}
          onClick={(customizeWithAssistant) => onClickCommunityDashboard(dashboard, customizeWithAssistant)}
          isLogo={isLogo}
          details={details}
          kind="suggested_dashboard"
          showAssistantButton={showAssistantButton}
          showCommunityBadge
          showCompatibilityBadge={showCompatBadge}
          compatibilityState={compatibilityMap.get(dashboard.id)}
          onCompatibilityCheck={onCompatibilityCheck}
        />
      );
    })}
  </Grid>
);
