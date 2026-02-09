import { css } from '@emotion/css';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom-v5-compat';
import { useAsyncFn, useAsyncRetry, useDebounce } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { config, getDataSourceSrv, isFetchError } from '@grafana/runtime';
import { Button, useStyles2, Stack, Grid, EmptyState, Alert, FilterInput, Box } from '@grafana/ui';

import { CompatibilityState } from './CompatibilityBadge';
import { DashboardCard } from './DashboardCard';
import { MappingContext } from './SuggestedDashboardsModal';
import { checkDashboardCompatibility } from './api/compatibilityApi';
import { fetchCommunityDashboards } from './api/dashboardLibraryApi';
import {
  CONTENT_KINDS,
  DashboardLibraryInteractions,
  DISCOVERY_METHODS,
  EVENT_LOCATIONS,
  SOURCE_ENTRY_POINTS,
} from './interactions';
import { GnetDashboard, isGnetDashboard } from './types';
import {
  getThumbnailUrl,
  getLogoUrl,
  buildDashboardDetails,
  onUseCommunityDashboard,
  interpolateDashboardForCompatibilityCheck,
  COMMUNITY_PAGE_SIZE_QUERY,
  COMMUNITY_RESULT_SIZE,
} from './utils/communityDashboardHelpers';

interface Props {
  onShowMapping: (context: MappingContext) => void;
  datasourceType?: string;
}

const SEARCH_DEBOUNCE_MS = 500;
const DEFAULT_SORT_ORDER = 'downloads';
const DEFAULT_SORT_DIRECTION = 'desc';
const INCLUDE_LOGO = true;
const INCLUDE_SCREENSHOTS = true;

export const CommunityDashboardSection = ({ onShowMapping, datasourceType }: Props) => {
  const [searchParams] = useSearchParams();
  const datasourceUid = searchParams.get('dashboardLibraryDatasourceUid');
  const [searchQuery, setSearchQuery] = useState('');
  const hasTrackedLoaded = useRef(false);
  const isCompatibilityAppEnabled = config.featureToggles.dashboardValidatorApp;

  // New state for compatibility badge feature
  const [compatibilityMap, setCompatibilityMap] = useState<Map<number, CompatibilityState>>(new Map());
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const hasAutoCheckedRef = useRef(false);

  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  useDebounce(
    () => {
      setDebouncedSearchQuery(searchQuery);
    },
    SEARCH_DEBOUNCE_MS,
    [searchQuery]
  );

  // Reset initial load flag when search query changes
  useEffect(() => {
    if (debouncedSearchQuery.trim()) {
      setIsInitialLoad(false);
    }
  }, [debouncedSearchQuery]);

  const {
    value: response,
    loading,
    error,
    retry,
  } = useAsyncRetry(async () => {
    if (!datasourceUid) {
      return null;
    }

    const ds = getDataSourceSrv().getInstanceSettings(datasourceUid);
    if (!ds) {
      return null;
    }

    try {
      const apiResponse = await fetchCommunityDashboards({
        orderBy: DEFAULT_SORT_ORDER,
        direction: DEFAULT_SORT_DIRECTION,
        page: 1,
        pageSize: COMMUNITY_PAGE_SIZE_QUERY,
        includeLogo: INCLUDE_LOGO,
        includeScreenshots: INCLUDE_SCREENSHOTS,
        dataSourceSlugIn: ds.type,
        filter: debouncedSearchQuery.trim() || undefined,
      });

      // Track search if query is present
      if (debouncedSearchQuery.trim()) {
        DashboardLibraryInteractions.searchPerformed({
          datasourceTypes: [ds.type],
          sourceEntryPoint: SOURCE_ENTRY_POINTS.DATASOURCE_PAGE,
          eventLocation: EVENT_LOCATIONS.MODAL_COMMUNITY_TAB,
          hasResults: apiResponse.items.length > 0,
          resultCount: apiResponse.items.length,
        });
      }

      return {
        dashboards: apiResponse.items.slice(0, COMMUNITY_RESULT_SIZE),
        datasourceType: ds.type,
      };
    } catch (err) {
      console.error('Error loading community dashboards', err);
      throw err;
    }
  }, [datasourceUid, debouncedSearchQuery]);

  // Track analytics only once on first successful load
  useEffect(() => {
    if (!loading && !hasTrackedLoaded.current && response?.dashboards && response.dashboards.length > 0) {
      DashboardLibraryInteractions.loaded({
        numberOfItems: response.dashboards.length,
        contentKinds: [CONTENT_KINDS.COMMUNITY_DASHBOARD],
        datasourceTypes: [response.datasourceType],
        sourceEntryPoint: SOURCE_ENTRY_POINTS.DATASOURCE_PAGE,
        eventLocation: EVENT_LOCATIONS.MODAL_COMMUNITY_TAB,
      });
      hasTrackedLoaded.current = true;
    }
  }, [loading, response]);

  const styles = useStyles2(getStyles);

  // Determine what to show in results area
  const dashboards = Array.isArray(response?.dashboards) ? response.dashboards : [];
  const showEmptyState = !loading && (!response?.dashboards || response.dashboards.length === 0);
  const showError = !loading && error;

  const [{ error: isPreviewDashboardError }, onPreviewCommunityDashboard] = useAsyncFn(
    async (dashboard: GnetDashboard) => {
      if (!response) {
        return;
      }

      // Track item click
      DashboardLibraryInteractions.itemClicked({
        contentKind: CONTENT_KINDS.COMMUNITY_DASHBOARD,
        datasourceTypes: [response.datasourceType],
        libraryItemId: String(dashboard.id),
        libraryItemTitle: dashboard.name,
        sourceEntryPoint: SOURCE_ENTRY_POINTS.DATASOURCE_PAGE,
        eventLocation: EVENT_LOCATIONS.MODAL_COMMUNITY_TAB,
        discoveryMethod: debouncedSearchQuery.trim() ? DISCOVERY_METHODS.SEARCH : DISCOVERY_METHODS.BROWSE,
      });

      await onUseCommunityDashboard({
        dashboard,
        datasourceUid: datasourceUid || '',
        datasourceType: response.datasourceType,
        eventLocation: EVENT_LOCATIONS.MODAL_COMMUNITY_TAB,
        onShowMapping,
      });
    },
    [response, datasourceUid, debouncedSearchQuery, onShowMapping]
  );

  // Handler for checking compatibility of a single dashboard
  const handleCheckCompatibility = useCallback(
    async (dashboard: GnetDashboard, triggerMethod: 'manual' | 'auto_initial_load') => {
      if (!datasourceUid || !response?.datasourceType) {
        return;
      }

      // Set loading state
      setCompatibilityMap((prev) => new Map(prev).set(dashboard.id, { status: 'loading' }));

      // Track analytics: check triggered
      DashboardLibraryInteractions.compatibilityCheckTriggered({
        dashboardId: String(dashboard.id),
        dashboardTitle: dashboard.name,
        datasourceType: response.datasourceType,
        triggerMethod,
        eventLocation: EVENT_LOCATIONS.MODAL_COMMUNITY_TAB,
      });

      try {
        const interpolatedDashboard = await interpolateDashboardForCompatibilityCheck(dashboard.id, datasourceUid);

        // Call compatibility API directly
        const result = await checkDashboardCompatibility(interpolatedDashboard, [
          {
            uid: datasourceUid,
            type: response.datasourceType,
            name: getDataSourceSrv().getInstanceSettings(datasourceUid)?.name ?? '',
          },
        ]);

        // Calculate metrics from first datasource result
        const dsResult = result.datasourceResults[0];
        const score = Math.round(dsResult.compatibilityScore * 100);
        const metricsFound = dsResult.foundMetrics;
        const metricsTotal = dsResult.totalMetrics;

        // Update state with success
        setCompatibilityMap((prev) =>
          new Map(prev).set(dashboard.id, {
            status: 'success',
            score,
            metricsFound,
            metricsTotal,
          })
        );

        // Track analytics: check completed
        DashboardLibraryInteractions.compatibilityCheckCompleted({
          dashboardId: String(dashboard.id),
          dashboardTitle: dashboard.name,
          datasourceType: response.datasourceType,
          score,
          metricsFound,
          metricsTotal,
          triggerMethod,
          eventLocation: EVENT_LOCATIONS.MODAL_COMMUNITY_TAB,
        });
      } catch (err) {
        console.error('Error checking dashboard compatibility:', err);

        const errorMessage = isFetchError(err) ? err.data?.message : 'Failed to check compatibility';
        const errorCode = isFetchError(err) ? err.data?.code : undefined;

        setCompatibilityMap((prev) =>
          new Map(prev).set(dashboard.id, {
            status: 'error',
            errorMessage,
            errorCode,
          })
        );
      }
    },
    [datasourceUid, response]
  );

  // Auto-trigger compatibility checks on initial load for Prometheus datasources
  useEffect(() => {
    if (
      !loading &&
      isInitialLoad &&
      !hasAutoCheckedRef.current &&
      response?.dashboards &&
      response.dashboards.length > 0 &&
      datasourceUid &&
      response.datasourceType === 'prometheus' &&
      isCompatibilityAppEnabled
    ) {
      hasAutoCheckedRef.current = true;

      // Trigger checks for all dashboards on initial load
      // currently 6 dashboards in total
      response.dashboards.forEach((dashboard) => {
        handleCheckCompatibility(dashboard, 'auto_initial_load');
      });
    }
  }, [loading, isInitialLoad, response, datasourceUid, handleCheckCompatibility, isCompatibilityAppEnabled]);

  return (
    <Stack direction="column" gap={2} height="100%">
      {isPreviewDashboardError && (
        <div>
          <Alert
            title={t('dashboard-library.community-error-title', 'Error loading community dashboard')}
            severity="error"
          >
            <Trans i18nKey="dashboard-library.community-error-description">Failed to load community dashboard.</Trans>
          </Alert>
        </div>
      )}
      <FilterInput
        placeholder={
          datasourceType
            ? t(
                'dashboard-library.community-search-placeholder-with-datasource',
                'Search {{datasourceType}} community dashboards...',
                { datasourceType }
              )
            : t('dashboard-library.community-search-placeholder', 'Search community dashboards...')
        }
        value={searchQuery}
        onChange={setSearchQuery}
      />

      <div className={styles.resultsContainer}>
        {loading ? (
          <Grid
            gap={4}
            columns={{
              xs: 1,
              sm: 2,
              lg: 3,
            }}
          >
            {Array.from({ length: COMMUNITY_RESULT_SIZE }).map((_, i) => (
              <DashboardCard.Skeleton key={`skeleton-${i}`} />
            ))}
          </Grid>
        ) : showError ? (
          <Stack direction="column" alignItems="center" gap={2}>
            <Alert
              title={t('dashboard-library.community-error-title', 'Error loading community dashboards')}
              severity="error"
            >
              <Trans i18nKey="dashboard-library.community-error">
                Failed to load community dashboards. Please try again.
              </Trans>
            </Alert>
            <Button variant="secondary" onClick={retry}>
              <Trans i18nKey="dashboard-library.retry">Retry</Trans>
            </Button>
          </Stack>
        ) : showEmptyState ? (
          <EmptyState
            variant="call-to-action"
            message={
              datasourceType
                ? t(
                    'dashboard-library.community-empty-title-with-datasource',
                    'No {{datasourceType}} community dashboards found',
                    { datasourceType }
                  )
                : t('dashboard-library.community-empty-title', 'No community dashboards found')
            }
            button={
              <Button
                variant="secondary"
                onClick={() => window.open('https://grafana.com/grafana/dashboards/', '_blank')}
              >
                <Trans i18nKey="dashboard-library.browse-grafana-com">Browse Grafana.com</Trans>
              </Button>
            }
          >
            {searchQuery && !datasourceType ? (
              <Trans i18nKey="dashboard-library.no-community-dashboards-search">
                Try a different search term or browse more dashboards on Grafana.com.
              </Trans>
            ) : (
              <Trans i18nKey="dashboard-library.no-community-dashboards-datasource">
                Try a different search term or browse dashboards for different datasource types on Grafana.com.
              </Trans>
            )}
          </EmptyState>
        ) : (
          <Stack direction="column" gap={2}>
            <Grid
              gap={4}
              columns={{
                xs: 1,
                sm: dashboards.length >= 2 ? 2 : 1,
                lg: dashboards.length >= 3 ? 3 : dashboards.length >= 2 ? 2 : 1,
              }}
            >
              {dashboards.map((dashboard) => {
                const thumbnailUrl = getThumbnailUrl(dashboard);
                const logoUrl = getLogoUrl(dashboard);
                const imageUrl = thumbnailUrl || logoUrl;
                const isLogo = !thumbnailUrl;
                const details = buildDashboardDetails(dashboard);

                // Only show badge for Prometheus datasources
                const showBadge =
                  isCompatibilityAppEnabled && !!datasourceUid && response?.datasourceType === 'prometheus';

                return (
                  <DashboardCard
                    key={dashboard.id}
                    title={dashboard.name}
                    imageUrl={imageUrl}
                    dashboard={dashboard}
                    onClick={() => onPreviewCommunityDashboard(dashboard)}
                    isLogo={isLogo}
                    details={details}
                    kind="suggested_dashboard"
                    showCompatibilityBadge={showBadge}
                    compatibilityState={compatibilityMap.get(dashboard.id)}
                    onCompatibilityCheck={
                      showBadge && isGnetDashboard(dashboard)
                        ? () => handleCheckCompatibility(dashboard, 'manual')
                        : undefined
                    }
                  />
                );
              })}
            </Grid>
            <Box display="flex" justifyContent="end" gap={2} paddingRight={1.5}>
              <Button
                variant="secondary"
                onClick={() => window.open('https://grafana.com/grafana/dashboards/', '_blank')}
              >
                <Trans i18nKey="dashboard-library.browse-grafana-com">Browse Grafana.com</Trans>
              </Button>
            </Box>
          </Stack>
        )}
      </div>
    </Stack>
  );
};

function getStyles(theme: GrafanaTheme2) {
  return {
    resultsContainer: css({
      width: '100%',
      flex: 1,
      overflow: 'auto',
      paddingBottom: theme.spacing(2),
    }),
  };
}
