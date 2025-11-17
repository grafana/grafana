import { css } from '@emotion/css';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom-v5-compat';
import { useAsync } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { getDataSourceSrv, locationService } from '@grafana/runtime';
import { Button, useStyles2, Grid } from '@grafana/ui';
import { PluginDashboard } from 'app/types/plugins';

import { DashboardCard } from './DashboardCard';
import { MappingContext, SuggestedDashboardsModal } from './SuggestedDashboardsModal';
import { fetchCommunityDashboards, fetchProvisionedDashboards } from './api/dashboardLibraryApi';
import {
  CONTENT_KINDS,
  CREATION_ORIGINS,
  DashboardLibraryInteractions,
  DISCOVERY_METHODS,
  EVENT_LOCATIONS,
  SOURCE_ENTRY_POINTS,
} from './interactions';
import { GnetDashboard } from './types';
import {
  getThumbnailUrl,
  getLogoUrl,
  buildDashboardDetails,
  onUseCommunityDashboard,
} from './utils/communityDashboardHelpers';
import { getProvisionedDashboardImageUrl } from './utils/provisionedDashboardHelpers';

interface Props {
  datasourceUid?: string;
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

export const SuggestedDashboards = ({ datasourceUid }: Props) => {
  const styles = useStyles2(getStyles);
  const hasTrackedLoaded = useRef(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const showLibraryModal = searchParams.get('dashboardLibraryModal') === 'open';

  // Validate and get default tab from URL params
  const tabParam = searchParams.get('dashboardLibraryTab');
  const defaultTab: 'datasource' | 'community' = tabParam === 'community' ? 'community' : 'datasource';

  const [mappingContext, setMappingContext] = useState<MappingContext | null>(null);

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

      const community = communityResponse.items;

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

      // Determine if there are more dashboards available beyond what we're showing
      // Show "View all" if: more than 1 provisioned exists OR we got the full page size of community dashboards
      const hasMoreDashboards = provisioned.length > 1 || community.length >= SUGGESTED_COMMUNITY_PAGE_SIZE;

      return { dashboards: mixed, hasMoreDashboards };
    } catch (error) {
      console.error('Error loading suggested dashboards', error);
      return { dashboards: [], hasMoreDashboards: false };
    }
  }, [datasourceUid]);

  // Determine which tab should be default based on available data
  const computedDefaultTab = useMemo((): 'datasource' | 'community' => {
    if (!result || loading) {
      return 'datasource'; // Default while loading
    }

    const hasProvisioned = result.dashboards.some((d) => d.type === 'provisioned');

    // Prefer datasource tab if it has data, otherwise community
    return hasProvisioned ? 'datasource' : 'community';
  }, [result, loading]);

  // Track analytics only once on first successful load
  useEffect(() => {
    if (!loading && !hasTrackedLoaded.current && result && result.dashboards.length > 0) {
      const contentKinds = [
        ...new Set(
          result.dashboards.map((m) =>
            m.type === 'provisioned' ? CONTENT_KINDS.DATASOURCE_DASHBOARD : CONTENT_KINDS.COMMUNITY_DASHBOARD
          )
        ),
      ];

      DashboardLibraryInteractions.loaded({
        numberOfItems: result.dashboards.length,
        contentKinds,
        datasourceTypes: [datasourceType],
        sourceEntryPoint: SOURCE_ENTRY_POINTS.DATASOURCE_PAGE,
        eventLocation: EVENT_LOCATIONS.EMPTY_DASHBOARD,
      });
      hasTrackedLoaded.current = true;
    }
  }, [loading, result, datasourceType]);

  const onModalDismiss = () => {
    // Remove modal-related query params while keeping datasourceUid
    setSearchParams((params) => {
      params.delete('dashboardLibraryModal');
      params.delete('dashboardLibraryTab');
      return params;
    });
    setMappingContext(null);
  };

  const onOpenModal = (tab: 'datasource' | 'community') => {
    setSearchParams((params) => {
      const newParams = new URLSearchParams(params);
      newParams.set('dashboardLibraryModal', 'open');
      newParams.set('dashboardLibraryTab', tab);
      return newParams;
    });
  };

  const onShowMapping = (context: MappingContext) => {
    setMappingContext(context);
    onOpenModal(computedDefaultTab);
  };

  const onUseProvisionedDashboard = (dashboard: PluginDashboard) => {
    if (!datasourceUid) {
      return;
    }

    const ds = getDataSourceSrv().getInstanceSettings(datasourceUid);
    if (!ds) {
      return;
    }

    DashboardLibraryInteractions.itemClicked({
      contentKind: CONTENT_KINDS.DATASOURCE_DASHBOARD,
      datasourceTypes: [ds.type],
      libraryItemId: dashboard.uid,
      libraryItemTitle: dashboard.title,
      sourceEntryPoint: SOURCE_ENTRY_POINTS.DATASOURCE_PAGE,
      eventLocation: EVENT_LOCATIONS.EMPTY_DASHBOARD,
      discoveryMethod: DISCOVERY_METHODS.BROWSE,
    });

    // Navigate to template route (existing flow)
    const params = new URLSearchParams({
      datasource: datasourceUid,
      title: dashboard.title || 'Template',
      pluginId: dashboard.pluginId,
      path: dashboard.path,
      sourceEntryPoint: SOURCE_ENTRY_POINTS.DATASOURCE_PAGE,
      libraryItemId: dashboard.uid,
      creationOrigin: CREATION_ORIGINS.DASHBOARD_LIBRARY_DATASOURCE_DASHBOARD,
      eventLocation: EVENT_LOCATIONS.EMPTY_DASHBOARD,
      contentKind: CONTENT_KINDS.DATASOURCE_DASHBOARD,
    });

    locationService.push(`/dashboard/template?${params.toString()}`);
  };

  const onPreviewCommunityDashboard = (dashboard: GnetDashboard) => {
    if (!datasourceUid) {
      return;
    }

    const ds = getDataSourceSrv().getInstanceSettings(datasourceUid);
    if (!ds) {
      return;
    }

    // Track item click
    DashboardLibraryInteractions.itemClicked({
      contentKind: CONTENT_KINDS.COMMUNITY_DASHBOARD,
      datasourceTypes: [ds.type],
      libraryItemId: String(dashboard.id),
      libraryItemTitle: dashboard.name,
      sourceEntryPoint: SOURCE_ENTRY_POINTS.DATASOURCE_PAGE,
      eventLocation: EVENT_LOCATIONS.EMPTY_DASHBOARD,
      discoveryMethod: DISCOVERY_METHODS.BROWSE,
    });

    onUseCommunityDashboard({
      dashboard,
      datasourceUid,
      datasourceType: ds.type,
      eventLocation: EVENT_LOCATIONS.EMPTY_DASHBOARD,
      onShowMapping: onShowMapping,
    });
  };

  // Don't render if no dashboards or still loading
  if (!loading && (!result || result.dashboards.length === 0)) {
    return null;
  }

  return (
    <>
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
            <Button variant="secondary" fill="outline" onClick={() => onOpenModal(computedDefaultTab)} size="sm">
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
                      kind="suggested_dashboard"
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
                      onClick={() => onPreviewCommunityDashboard(item.dashboard)}
                      isLogo={isLogo}
                      details={details}
                      kind="suggested_dashboard"
                    />
                  );
                }
              }) || []}
        </Grid>
      </div>
      <SuggestedDashboardsModal
        isOpen={showLibraryModal}
        onDismiss={onModalDismiss}
        initialMappingContext={mappingContext}
        defaultTab={defaultTab}
      />
    </>
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
