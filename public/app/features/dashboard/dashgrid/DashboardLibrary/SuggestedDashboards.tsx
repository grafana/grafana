import { css } from '@emotion/css';
import { useMemo } from 'react';
import { useAsync } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { getDataSourceSrv, locationService } from '@grafana/runtime';
import { Button, useStyles2, Grid } from '@grafana/ui';
import { DataSourceInput } from 'app/features/manage-dashboards/state/reducers';
import { PluginDashboard } from 'app/types/plugins';

import { DashboardCard } from './DashboardCard';
import { MappingContext } from './DashboardLibraryModal';
import {
  fetchCommunityDashboard,
  fetchCommunityDashboards,
  fetchProvisionedDashboards,
} from './api/dashboardLibraryApi';
import { DashboardLibraryInteractions } from './interactions';
import { GnetDashboard } from './types';
import { tryAutoMapDatasources, parseConstantInputs, isDataSourceInput } from './utils/autoMapDatasources';
import {
  getThumbnailUrl,
  getLogoUrl,
  buildDashboardDetails,
  navigateToTemplate,
} from './utils/communityDashboardHelpers';
import { getProvisionedDashboardImageUrl } from './utils/provisionedDashboardHelpers';

interface Props {
  datasourceUid?: string;
  onOpenModal: (defaultTab: 'datasource' | 'community') => void;
  onShowMapping: (context: MappingContext) => void;
}

type MixedDashboard =
  | { type: 'provisioned'; dashboard: PluginDashboard; index: number }
  | { type: 'community'; dashboard: GnetDashboard };

type SuggestedDashboardsResult = {
  dashboards: MixedDashboard[];
  hasMoreDashboards: boolean;
};

// Constants for suggested dashboards API params
const SUGGESTED_COMMUNITY_PAGE_SIZE = 2;
const DEFAULT_SORT_ORDER = 'downloads';
const DEFAULT_SORT_DIRECTION = 'desc';
const INCLUDE_SCREENSHOTS = true;
const INCLUDE_LOGO = true;

export const SuggestedDashboards = ({ datasourceUid, onOpenModal, onShowMapping }: Props) => {
  const styles = useStyles2(getStyles);

  // Get datasource type for dynamic title
  const datasourceType = useMemo(() => {
    if (!datasourceUid) {
      return '';
    }
    const ds = getDataSourceSrv().getInstanceSettings(datasourceUid);
    return ds?.type || '';
  }, [datasourceUid]);

  const { value: result, loading } = useAsync(async (): Promise<SuggestedDashboardsResult> => {
    if (!datasourceUid) {
      return { dashboards: [], hasMoreDashboards: false };
    }

    const ds = getDataSourceSrv().getInstanceSettings(datasourceUid);
    if (!ds) {
      return { dashboards: [], hasMoreDashboards: false };
    }

    try {
      // Fetch both provisioned and community dashboards in parallel
      const [provisioned, communityResponse] = await Promise.all([
        // Fetch provisioned dashboards
        fetchProvisionedDashboards(ds.type),

        // Fetch community dashboards
        fetchCommunityDashboards({
          orderBy: DEFAULT_SORT_ORDER,
          direction: DEFAULT_SORT_DIRECTION,
          page: 1,
          pageSize: SUGGESTED_COMMUNITY_PAGE_SIZE,
          includeScreenshots: INCLUDE_SCREENSHOTS,
          dataSourceSlugIn: ds.type,
          includeLogo: INCLUDE_LOGO,
        }),
      ]);

      const community = communityResponse.dashboards;

      // Mix: 1 provisioned + 2 community
      const mixed: MixedDashboard[] = [];

      // Take 1 provisioned if available
      if (provisioned.length > 0) {
        mixed.push({ type: 'provisioned', dashboard: provisioned[0], index: 0 });
      }

      // Take up to 2 community dashboards
      const communityCount = Math.min(2, community.length);
      for (let i = 0; i < communityCount; i++) {
        mixed.push({ type: 'community', dashboard: community[i] });
      }

      // Fill remaining slots if we have less than 3
      while (mixed.length < 3) {
        const provisionedUsed = mixed.filter((m) => m.type === 'provisioned').length;
        const communityUsed = mixed.filter((m) => m.type === 'community').length;

        if (provisionedUsed < provisioned.length) {
          mixed.push({ type: 'provisioned', dashboard: provisioned[provisionedUsed], index: provisionedUsed });
        } else if (communityUsed < community.length) {
          mixed.push({ type: 'community', dashboard: community[communityUsed] });
        } else {
          break; // Not enough dashboards
        }
      }

      // Track analytics
      if (mixed.length > 0) {
        const contentKinds: Array<'datasource_dashboard' | 'community_dashboard'> = [
          ...new Set(mixed.map((m) => (m.type === 'provisioned' ? 'datasource_dashboard' : 'community_dashboard'))),
        ];

        DashboardLibraryInteractions.loaded({
          numberOfItems: mixed.length,
          contentKinds,
          datasourceTypes: [ds.type],
          sourceEntryPoint: 'datasource_page',
          eventLocation: 'empty_dashboard',
        });
      }

      // Determine if there are more dashboards available beyond what we're showing
      // Show "View all" if: more than 1 provisioned exists OR we got the full page size of community dashboards
      const hasMoreDashboards = provisioned.length > 1 || community.length >= SUGGESTED_COMMUNITY_PAGE_SIZE;

      return { dashboards: mixed, hasMoreDashboards };
    } catch (error) {
      console.error('Error loading suggested dashboards', error);
      return { dashboards: [], hasMoreDashboards: false };
    }
  }, [datasourceUid]);

  // Determine default tab based on what data is available
  const defaultTab = useMemo((): 'datasource' | 'community' => {
    if (!result || loading) {
      return 'datasource'; // Default while loading
    }

    const hasProvisioned = result.dashboards.some((d) => d.type === 'provisioned');

    // Prefer datasource tab if it has data, otherwise community
    return hasProvisioned ? 'datasource' : 'community';
  }, [result, loading]);

  const onUseProvisionedDashboard = (dashboard: PluginDashboard) => {
    if (!datasourceUid) {
      return;
    }

    const ds = getDataSourceSrv().getInstanceSettings(datasourceUid);
    if (!ds) {
      return;
    }

    DashboardLibraryInteractions.itemClicked({
      contentKind: 'datasource_dashboard',
      datasourceTypes: [ds.type],
      libraryItemId: dashboard.uid,
      libraryItemTitle: dashboard.title,
      sourceEntryPoint: 'datasource_page',
      eventLocation: 'empty_dashboard',
    });

    // Navigate to template route (existing flow)
    const params = new URLSearchParams({
      datasource: datasourceUid,
      title: dashboard.title || 'Template',
      pluginId: dashboard.pluginId,
      path: dashboard.path,
      sourceEntryPoint: 'datasource_page',
      libraryItemId: dashboard.uid,
      creationOrigin: 'dashboard_library_datasource_dashboard',
    });

    locationService.push(`/dashboard/template?${params.toString()}`);
  };

  const onUseCommunityDashboard = async (dashboard: GnetDashboard) => {
    if (!datasourceUid) {
      return;
    }

    const ds = getDataSourceSrv().getInstanceSettings(datasourceUid);
    if (!ds) {
      return;
    }

    DashboardLibraryInteractions.itemClicked({
      contentKind: 'community_dashboard',
      datasourceTypes: [ds.type],
      libraryItemId: String(dashboard.id),
      libraryItemTitle: dashboard.name,
      sourceEntryPoint: 'datasource_page',
      eventLocation: 'empty_dashboard',
    });

    try {
      // Fetch full dashboard from Gcom, this is the JSON with __inputs
      const fullDashboard = await fetchCommunityDashboard(dashboard.id);
      const dashboardJson = fullDashboard.json;

      // Parse datasource requirements from __inputs
      const dsInputs: DataSourceInput[] = dashboardJson.__inputs?.filter(isDataSourceInput) || [];

      // Parse constant inputs - these always need user review
      const constantInputs = parseConstantInputs(dashboardJson.__inputs || []);

      // Try auto-mapping datasources
      const mappingResult = tryAutoMapDatasources(dsInputs, datasourceUid || '');

      // Decide whether to show mapping form or navigate directly
      // Show mapping form if: (a) there are unmapped datasources OR (b) there are constants
      const needsMapping = mappingResult.unmappedInputs.length > 0 || constantInputs.length > 0;

      if (!needsMapping) {
        // No mapping needed - all datasources auto-mapped, no constants
        navigateToTemplate(dashboard.name, dashboard.id, datasourceUid || '', mappingResult.mappings);
      } else {
        // Show mapping form for unmapped datasources and/or constants
        onShowMapping({
          dashboardName: dashboard.name,
          dashboardJson,
          unmappedInputs: mappingResult.unmappedInputs,
          constantInputs,
          existingMappings: mappingResult.mappings,
          onInterpolateAndNavigate: (mappings) =>
            navigateToTemplate(dashboard.name, dashboard.id, datasourceUid || '', mappings),
        });
      }
    } catch (err) {
      console.error('Error loading community dashboard:', err);
      // TODO: Show error notification
    }
  };

  // Don't render if no dashboards or still loading
  if (!loading && (!result || result.dashboards.length === 0)) {
    return null;
  }

  return (
    <div className={styles.container} data-testid="suggested-dashboards">
      <div className={styles.header}>
        <div className={styles.headerText}>
          <h1 className={styles.title}>
            {datasourceType
              ? t(
                  'dashboard-library.suggested-dashboards-title-with-datasource',
                  'Build a dashboard using suggested options for your {{datasourceType}} data source',
                  { datasourceType }
                )
              : t(
                  'dashboard-library.suggested-dashboards-title',
                  'Build a dashboard using suggested options for your selected data source'
                )}
          </h1>
          <p className={styles.subtitle}>
            <Trans i18nKey="dashboard-library.suggested-dashboards-subtitle">
              Browse and select from data-source provided or community dashboards
            </Trans>
          </p>
        </div>
        {result?.hasMoreDashboards && (
          <Button variant="secondary" fill="outline" onClick={() => onOpenModal(defaultTab)} size="sm">
            <Trans i18nKey="dashboard-library.view-all">View all</Trans>
          </Button>
        )}
      </div>

      <Grid
        gap={4}
        columns={{
          xs: 1,
          sm: 2,
          lg: 3,
        }}
      >
        {loading
          ? Array.from({ length: 3 }).map((_, i) => <DashboardCard.Skeleton key={`skeleton-${i}`} />)
          : result?.dashboards.map((item, idx) => {
              if (item.type === 'provisioned') {
                return (
                  <DashboardCard
                    key={`provisioned-${item.dashboard.uid}-${idx}`}
                    title={item.dashboard.title}
                    imageUrl={getProvisionedDashboardImageUrl(item.index)}
                    dashboard={item.dashboard}
                    onClick={() => onUseProvisionedDashboard(item.dashboard)}
                    showDatasourceProvidedBadge={true}
                    dimThumbnail={true}
                    buttonText={<Trans i18nKey="dashboard-library.card.use-dashboard-button">Use dashboard</Trans>}
                  />
                );
              } else {
                const thumbnailUrl = getThumbnailUrl(item.dashboard);
                const imageUrl = thumbnailUrl || getLogoUrl(item.dashboard);
                const isLogo = !thumbnailUrl;
                const details = buildDashboardDetails(item.dashboard);

                return (
                  <DashboardCard
                    key={`community-${item.dashboard.id}-${idx}`}
                    title={item.dashboard.name}
                    imageUrl={imageUrl}
                    dashboard={item.dashboard}
                    onClick={() => onUseCommunityDashboard(item.dashboard)}
                    isLogo={isLogo}
                    details={details}
                    buttonText={<Trans i18nKey="dashboard-library.card.use-dashboard-button">Use dashboard</Trans>}
                  />
                );
              }
            }) || []}
      </Grid>
    </div>
  );
};

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css({
      borderRadius: theme.shape.radius.default,
      borderColor: theme.colors.border.strong,
      borderStyle: 'dashed',
      borderWidth: 1,
      padding: theme.spacing(4),
    }),
    header: css({
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: theme.spacing(1),
      gap: theme.spacing(2),
      paddingRight: theme.spacing(2),
      paddingLeft: theme.spacing(2),
    }),
    headerText: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(0.5),
      flex: 1,
    }),
    title: css({
      margin: 0,
      fontSize: theme.typography.h2.fontSize,
      fontWeight: theme.typography.fontWeightMedium,
      lineHeight: theme.typography.h2.lineHeight,
    }),
    subtitle: css({
      margin: 0,
      fontSize: theme.typography.body.fontSize,
      color: theme.colors.text.secondary,
      lineHeight: theme.typography.body.lineHeight,
    }),
  };
}
