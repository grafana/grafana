import { css } from '@emotion/css';
import { useBooleanFlagValue } from '@openfeature/react-sdk';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useAsyncFn, useDebounce } from 'react-use';

import type { GrafanaTheme2 } from '@grafana/data/themes';
import { t } from '@grafana/i18n';
import { config, getDataSourceSrv, isFetchError, locationService } from '@grafana/runtime';
import { FilterInput, Grid, Pagination, Stack } from '@grafana/ui';
import { useStyles2 } from '@grafana/ui/themes';
import { type PluginDashboard } from 'app/types/plugins';

import { DASHBOARD_LIBRARY_ROUTES } from '../../types';
import { type CompatibilityState } from '../CompatibilityBadge';
import { DashboardCard } from '../DashboardCard';
import type { MappingContext } from '../SuggestedDashboardsModal';
import { useTrackingContext } from '../TrackingContext';
import { checkDashboardCompatibility } from '../api/compatibilityApi';
import { fetchCommunityDashboards } from '../api/dashboardLibraryApi';
import { CONTENT_KINDS, CREATION_ORIGINS, DISCOVERY_METHODS, PAGE_SIZE } from '../constants';
import { DashboardLibraryInteractions, SuggestedDashboardInteractions } from '../interactions';
import { type GnetDashboard } from '../types';
import { onUseCommunityDashboard, interpolateDashboardForCompatibilityCheck } from '../utils/communityDashboardHelpers';
import { getPageSlice } from '../utils/suggestedDashboardHelpers';

import { DashboardResultsGrid } from './DashboardResultsGrid';
import { EmptyResults } from './EmptyResults';
import { ListHeader } from './ListHeader';

const SEARCH_DEBOUNCE_MS = 500;
const DEFAULT_SORT_ORDER = 'downloads';
const DEFAULT_SORT_DIRECTION = 'desc' as const;
const INCLUDE_LOGO = true;
const INCLUDE_SCREENSHOTS = true;

interface SuggestedDashboardsListProps {
  provisionedDashboards: PluginDashboard[];
  communityDashboards: GnetDashboard[];
  communityTotalPages: number;
  lastPageItemCount?: number;
  onLastPageItemCount?: (count: number) => void;
  datasourceUid?: string;
  datasourceType: string;
  isDashboardsLoading: boolean;
  onShowMapping: (context: MappingContext) => void;
  onDismiss: () => void;
}

interface CommunityCache {
  searchQuery: string;
  items: Array<GnetDashboard | undefined>;
  cachedPages: Set<number>;
  totalApiPages: number;
  /** Exact count of community items on the last API page (once fetched). */
  lastPageItemCount?: number;
}

export const SuggestedDashboardsList = ({
  provisionedDashboards,
  communityDashboards,
  communityTotalPages,
  lastPageItemCount: initialLastPageItemCount,
  onLastPageItemCount,
  datasourceUid,
  datasourceType,
  isDashboardsLoading,
  onShowMapping,
  onDismiss,
}: SuggestedDashboardsListProps) => {
  const styles = useStyles2(getStyles);
  const { sourceEntryPoint, eventLocation } = useTrackingContext();
  const isSuggestedDashboardsAssistantButtonEnabled = useBooleanFlagValue('suggestedDashboardsAssistantButton', false);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [isCommunityLoading, setIsCommunityLoading] = useState(false);
  const hasTrackedLoaded = useRef(false);
  const hasAutoCheckedRef = useRef(false);
  const isCompatibilityAppEnabled = config.featureToggles.dashboardValidatorApp;

  const [compatibilityMap, setCompatibilityMap] = useState<Map<number, CompatibilityState>>(new Map());

  // Community cache state — initialized with pre-fetched page 1 data from the loader
  const [communityCache, setCommunityCache] = useState<CommunityCache>(() => ({
    searchQuery: '',
    items: communityDashboards,
    cachedPages: new Set<number>(communityDashboards.length > 0 ? [1] : []),
    totalApiPages: communityTotalPages,
    // Use persisted value from the module cache, or infer when there's only one page
    lastPageItemCount: initialLastPageItemCount ?? (communityTotalPages <= 1 ? communityDashboards.length : undefined),
  }));

  // Filter provisioned dashboards client-side
  const filteredProvisioned = useMemo(() => {
    if (!debouncedSearchQuery.trim()) {
      return provisionedDashboards;
    }
    const query = debouncedSearchQuery.toLowerCase();
    return provisionedDashboards.filter(
      (d) => d.title.toLowerCase().includes(query) || (d.description ?? '').toLowerCase().includes(query)
    );
  }, [provisionedDashboards, debouncedSearchQuery]);

  // Debounce search — updates debouncedSearchQuery and resets cache after delay
  useDebounce(
    () => {
      setDebouncedSearchQuery(searchQuery);
      setCurrentPage(1);

      // Clear community cache when search changes
      if (searchQuery.trim()) {
        setCommunityCache({
          searchQuery: searchQuery.trim(),
          items: [],
          cachedPages: new Set<number>(),
          totalApiPages: 0,
          lastPageItemCount: undefined,
        });
      } else {
        // Revert to pre-fetched data — page 1 is already cached from the loader
        setCommunityCache({
          searchQuery: '',
          items: communityDashboards,
          cachedPages: new Set<number>(communityDashboards.length > 0 ? [1] : []),
          totalApiPages: communityTotalPages,
          lastPageItemCount:
            initialLastPageItemCount ?? (communityTotalPages <= 1 ? communityDashboards.length : undefined),
        });
      }
    },
    SEARCH_DEBOUNCE_MS,
    [searchQuery, communityDashboards, communityTotalPages]
  );

  // Calculate pagination slices for the merged provisioned + community list
  const { totalPages, provisionedSlice, communityNeededCount, communityStartIndex, communitySlice } = useMemo(
    () => getPageSlice({ currentPage, pageSize: PAGE_SIZE, filteredProvisioned, communityCache }),
    [currentPage, filteredProvisioned, communityCache]
  );

  // Auto-correct currentPage if it exceeds totalPages (e.g. after fetching the
  // last API page reveals fewer items than estimated)
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  // Fetch community pages as needed
  useEffect(() => {
    if (communityNeededCount <= 0 || !datasourceType || isDashboardsLoading) {
      return;
    }

    // The loader pre-fetches page 1, but the cache may not have it yet (useState
    // initializer ran when the prop was still empty). Sync it from the prop to
    // avoid a duplicate fetch — this triggers a re-render and the effect re-runs
    // with the cache populated.
    if (!communityCache.cachedPages.has(1) && communityDashboards.length > 0 && !debouncedSearchQuery.trim()) {
      setCommunityCache({
        searchQuery: '',
        items: communityDashboards,
        cachedPages: new Set<number>([1]),
        totalApiPages: communityTotalPages,
        lastPageItemCount:
          initialLastPageItemCount ?? (communityTotalPages <= 1 ? communityDashboards.length : undefined),
      });
      return;
    }

    const fetchNeeded = async () => {
      // Community items are fetched in pages of PAGE_SIZE from the API.
      // communityStartIndex is the offset into the flat community list (e.g. 8 means "start at the 9th community item").
      // We convert that offset to 1-based API page numbers:
      //   e.g. index 0–5 → page 1, index 6–11 → page 2, etc.
      const firstApiPage = Math.floor(communityStartIndex / PAGE_SIZE) + 1;
      // The last item we need is at (communityStartIndex + communityNeededCount - 1).
      // We find which API page contains that last item to know the full range of pages to fetch.
      const lastApiPage = Math.floor((communityStartIndex + communityNeededCount - 1) / PAGE_SIZE) + 1;

      const pagesToFetch: number[] = [];
      for (let p = firstApiPage; p <= lastApiPage; p++) {
        if (!communityCache.cachedPages.has(p)) {
          pagesToFetch.push(p);
        }
      }

      if (pagesToFetch.length === 0) {
        return;
      }

      setIsCommunityLoading(true);

      try {
        const responses = await Promise.all(
          pagesToFetch.map((page) =>
            fetchCommunityDashboards({
              orderBy: DEFAULT_SORT_ORDER,
              direction: DEFAULT_SORT_DIRECTION,
              page,
              pageSize: PAGE_SIZE,
              includeLogo: INCLUDE_LOGO,
              includeScreenshots: INCLUDE_SCREENSHOTS,
              dataSourceSlugIn: datasourceType,
              filter: debouncedSearchQuery.trim() || undefined,
            })
          )
        );

        let totalFetched = 0;

        setCommunityCache((prev) => {
          const newItems = [...prev.items];
          const newCachedPages = new Set(prev.cachedPages);
          let totalApiPages = prev.totalApiPages;
          let lastPageItemCount = prev.lastPageItemCount;

          // Place each page's items at their correct offset in the sparse items array
          responses.forEach((response, idx) => {
            const page = pagesToFetch[idx];
            const offset = (page - 1) * PAGE_SIZE;
            response.items.forEach((item, i) => {
              newItems[offset + i] = item;
            });
            newCachedPages.add(page);
            totalFetched += response.items.length;
            totalApiPages = response.pages;

            // When we fetch the last API page, record its exact item count
            // so we can compute an accurate total instead of overestimating
            if (page === response.pages) {
              lastPageItemCount = response.items.length;
              onLastPageItemCount?.(response.items.length);
            }
          });

          return {
            ...prev,
            items: newItems,
            cachedPages: newCachedPages,
            totalApiPages,
            lastPageItemCount,
          };
        });

        if (debouncedSearchQuery.trim()) {
          DashboardLibraryInteractions.searchPerformed({
            datasourceTypes: [datasourceType],
            sourceEntryPoint,
            eventLocation,
            hasResults: totalFetched > 0,
            resultCount: totalFetched,
          });
        }
      } catch (err) {
        console.error('Error loading community dashboards', err);
      } finally {
        setIsCommunityLoading(false);
      }
    };

    fetchNeeded();
  }, [
    currentPage,
    communityNeededCount,
    communityStartIndex,
    debouncedSearchQuery,
    datasourceType,
    isDashboardsLoading,
    communityCache.cachedPages,
    communityDashboards,
    communityTotalPages,
    initialLastPageItemCount,
    onLastPageItemCount,
    sourceEntryPoint,
    eventLocation,
  ]);

  // Track analytics on first load
  useEffect(() => {
    if (
      !isDashboardsLoading &&
      !hasTrackedLoaded.current &&
      (provisionedDashboards.length > 0 || communityDashboards.length > 0)
    ) {
      const contentKinds: Array<(typeof CONTENT_KINDS)[keyof typeof CONTENT_KINDS]> = [];
      if (provisionedDashboards.length > 0) {
        contentKinds.push(CONTENT_KINDS.DATASOURCE_DASHBOARD);
      }
      if (communityDashboards.length > 0) {
        contentKinds.push(CONTENT_KINDS.COMMUNITY_DASHBOARD);
      }

      SuggestedDashboardInteractions.loaded({
        numberOfItems: provisionedDashboards.length + communityDashboards.length,
        contentKinds,
        datasourceTypes: [datasourceType],
        sourceEntryPoint,
        eventLocation,
      });
      hasTrackedLoaded.current = true;
    }
  }, [
    isDashboardsLoading,
    provisionedDashboards,
    communityDashboards,
    datasourceType,
    sourceEntryPoint,
    eventLocation,
  ]);

  // Provisioned dashboard click handler
  const onClickProvisionedDashboard = (dashboard: PluginDashboard, customizeWithAssistant?: boolean) => {
    SuggestedDashboardInteractions.itemClicked({
      contentKind: CONTENT_KINDS.DATASOURCE_DASHBOARD,
      datasourceTypes: [dashboard.pluginId],
      libraryItemId: dashboard.uid,
      libraryItemTitle: dashboard.title,
      sourceEntryPoint,
      eventLocation,
      discoveryMethod: debouncedSearchQuery.trim() ? DISCOVERY_METHODS.SEARCH : DISCOVERY_METHODS.BROWSE,
      action: customizeWithAssistant ? 'assistant' : 'use_dashboard',
    });

    const params = new URLSearchParams({
      datasource: datasourceUid || '',
      title: dashboard.title || 'Template',
      pluginId: dashboard.pluginId,
      path: dashboard.path,
      suggestedDashboardBanner: 'true',
      sourceEntryPoint,
      libraryItemId: dashboard.uid,
      creationOrigin: CREATION_ORIGINS.DASHBOARD_LIBRARY_DATASOURCE_DASHBOARD,
      eventLocation,
      contentKind: CONTENT_KINDS.DATASOURCE_DASHBOARD,
    });

    if (customizeWithAssistant) {
      params.set('assistantSource', 'assistant_button');
    }

    const templateUrl = `${DASHBOARD_LIBRARY_ROUTES.Template}?${params.toString()}`;
    locationService.push(templateUrl);
  };

  // Community dashboard click handler
  const [{ error: isPreviewDashboardError }, onClickCommunityDashboard] = useAsyncFn(
    async (dashboard: GnetDashboard, customizeWithAssistant?: boolean) => {
      SuggestedDashboardInteractions.itemClicked({
        contentKind: CONTENT_KINDS.COMMUNITY_DASHBOARD,
        datasourceTypes: [datasourceType],
        libraryItemId: String(dashboard.id),
        libraryItemTitle: dashboard.name,
        sourceEntryPoint,
        eventLocation,
        discoveryMethod: debouncedSearchQuery.trim() ? DISCOVERY_METHODS.SEARCH : DISCOVERY_METHODS.BROWSE,
        action: customizeWithAssistant ? 'assistant' : 'use_dashboard',
      });

      await onUseCommunityDashboard({
        dashboard,
        datasourceUid: datasourceUid || '',
        sourceEntryPoint,
        eventLocation,
        onShowMapping,
        assistantSource: customizeWithAssistant ? 'assistant_button' : undefined,
      });
    },
    [datasourceType, datasourceUid, debouncedSearchQuery, onShowMapping, sourceEntryPoint, eventLocation]
  );

  // Compatibility check handler
  const onCheckCompatibility = async (dashboard: GnetDashboard, triggerMethod: 'manual' | 'auto_initial_load') => {
    if (!datasourceUid || !datasourceType) {
      return;
    }

    setCompatibilityMap((prev) => new Map(prev).set(dashboard.id, { status: 'loading' }));

    DashboardLibraryInteractions.compatibilityCheckTriggered({
      dashboardId: String(dashboard.id),
      dashboardTitle: dashboard.name,
      datasourceType,
      triggerMethod,
      eventLocation,
      sourceEntryPoint,
    });

    try {
      const interpolatedDashboard = await interpolateDashboardForCompatibilityCheck(dashboard.id, datasourceUid);

      const result = await checkDashboardCompatibility(interpolatedDashboard, [
        {
          uid: datasourceUid,
          type: datasourceType,
          name: getDataSourceSrv().getInstanceSettings(datasourceUid)?.name ?? '',
        },
      ]);

      const dsResult = result.datasourceResults[0];
      const score = Math.round(dsResult.compatibilityScore * 100);
      const metricsFound = dsResult.foundMetrics;
      const metricsTotal = dsResult.totalMetrics;

      setCompatibilityMap((prev) =>
        new Map(prev).set(dashboard.id, {
          status: 'success',
          score,
          metricsFound,
          metricsTotal,
        })
      );

      DashboardLibraryInteractions.compatibilityCheckCompleted({
        dashboardId: String(dashboard.id),
        dashboardTitle: dashboard.name,
        datasourceType,
        score,
        metricsFound,
        metricsTotal,
        triggerMethod,
        eventLocation,
        sourceEntryPoint,
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
  };

  // Auto-trigger compatibility checks on initial load for Prometheus
  useEffect(() => {
    if (
      !isDashboardsLoading &&
      !hasAutoCheckedRef.current &&
      communitySlice.length > 0 &&
      datasourceUid &&
      datasourceType === 'prometheus' &&
      isCompatibilityAppEnabled &&
      !debouncedSearchQuery.trim()
    ) {
      hasAutoCheckedRef.current = true;
      communitySlice.forEach((dashboard) => {
        onCheckCompatibility(dashboard, 'auto_initial_load');
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isDashboardsLoading,
    communitySlice,
    datasourceUid,
    datasourceType,
    isCompatibilityAppEnabled,
    debouncedSearchQuery,
  ]);

  const showLoading = isDashboardsLoading || isCommunityLoading;
  const hasNoResults = !showLoading && provisionedSlice.length === 0 && communitySlice.length === 0;

  const onCreateFromScratch = () => {
    DashboardLibraryInteractions.createFromScratchClicked({
      eventLocation,
    });
    onDismiss();
    locationService.push('/dashboard/new');
  };

  return (
    <Stack direction="column" gap={2} height="100%">
      <ListHeader error={isPreviewDashboardError} onCreateFromScratch={onCreateFromScratch} />
      <FilterInput
        placeholder={
          datasourceType
            ? t(
                'dashboard-library.merged-search-placeholder-with-datasource',
                'Search {{datasourceType}} dashboards...',
                { datasourceType }
              )
            : t('dashboard-library.merged-search-placeholder', 'Search dashboards...')
        }
        value={searchQuery}
        onChange={setSearchQuery}
      />
      <div className={styles.resultsContainer}>
        {showLoading ? (
          <Grid gap={4} columns={{ xs: 1, sm: 2, lg: 3 }}>
            {Array.from({ length: PAGE_SIZE }).map((_, i) => (
              <DashboardCard.Skeleton key={`skeleton-${i}`} />
            ))}
          </Grid>
        ) : hasNoResults ? (
          <EmptyResults datasourceType={datasourceType} hasSearchQuery={!!debouncedSearchQuery.trim()} />
        ) : (
          <DashboardResultsGrid
            provisionedSlice={provisionedSlice}
            communitySlice={communitySlice}
            currentPage={currentPage}
            datasourceType={datasourceType}
            datasourceUid={datasourceUid}
            isCompatibilityAppEnabled={isCompatibilityAppEnabled}
            compatibilityMap={compatibilityMap}
            showAssistantButton={isSuggestedDashboardsAssistantButtonEnabled}
            onClickProvisionedDashboard={onClickProvisionedDashboard}
            onClickCommunityDashboard={onClickCommunityDashboard}
            onCheckCompatibility={onCheckCompatibility}
          />
        )}
      </div>
      {totalPages > 1 && (
        <Pagination
          currentPage={currentPage}
          numberOfPages={totalPages}
          onNavigate={(page) => setCurrentPage(page)}
          className={styles.pagination}
        />
      )}
    </Stack>
  );
};

function getStyles(theme: GrafanaTheme2) {
  return {
    resultsContainer: css({
      width: '100%',
      overflow: 'auto',
      paddingBottom: theme.spacing(2),
    }),
    pagination: css({
      position: 'sticky',
      bottom: 0,
      backgroundColor: theme.colors.background.primary,
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 2,
      paddingTop: theme.spacing(2),
    }),
  };
}
