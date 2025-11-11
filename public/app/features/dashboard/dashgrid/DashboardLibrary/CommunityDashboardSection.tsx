import { css } from '@emotion/css';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom-v5-compat';
import { useAsync, useDebounce } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { getDataSourceSrv } from '@grafana/runtime';
import { Button, useStyles2, Stack, Grid, EmptyState, Alert, Pagination, FilterInput, Box } from '@grafana/ui';
import { DataSourceInput } from 'app/features/manage-dashboards/state/reducers';

import { DashboardCard } from './DashboardCard';
import { MappingContext } from './DashboardLibraryModal';
import { fetchCommunityDashboard, fetchCommunityDashboards } from './api/dashboardLibraryApi';
import { DashboardLibraryInteractions } from './interactions';
import { GnetDashboard } from './types';
import { tryAutoMapDatasources, parseConstantInputs, isDataSourceInput } from './utils/autoMapDatasources';
import {
  getThumbnailUrl,
  getLogoUrl,
  buildDashboardDetails,
  navigateToTemplate,
} from './utils/communityDashboardHelpers';

interface Props {
  onShowMapping: (context: MappingContext) => void;
  datasourceType?: string;
}

// Constants for community dashboard pagination and API params
const COMMUNITY_PAGE_SIZE = 9;
const COMMUNITY_PAGINATION_OFFSET = 4;
const SEARCH_DEBOUNCE_MS = 500;
const DEFAULT_SORT_ORDER = 'downloads';
const DEFAULT_SORT_DIRECTION = 'desc';
const INCLUDE_LOGO = true;
const INCLUDE_SCREENSHOTS = true;

export const CommunityDashboardSection = ({ onShowMapping, datasourceType }: Props) => {
  const [searchParams] = useSearchParams();
  const datasourceUid = searchParams.get('dashboardLibraryDatasourceUid');
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');

  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  useDebounce(
    () => {
      setDebouncedSearchQuery(searchQuery);
    },
    SEARCH_DEBOUNCE_MS,
    [searchQuery]
  );

  // Reset to page 1 when debounced search query changes
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchQuery]);

  const {
    value: response,
    loading,
    error,
  } = useAsync(async () => {
    if (!datasourceUid) {
      return null;
    }

    const ds = getDataSourceSrv().getInstanceSettings(datasourceUid);
    if (!ds) {
      return null;
    }

    try {
      const dashboards = await fetchCommunityDashboards({
        orderBy: DEFAULT_SORT_ORDER,
        direction: DEFAULT_SORT_DIRECTION,
        page: currentPage,
        pageSize: COMMUNITY_PAGE_SIZE,
        includeLogo: INCLUDE_LOGO,
        includeScreenshots: INCLUDE_SCREENSHOTS,
        dataSourceSlugIn: ds.type,
        filter: debouncedSearchQuery.trim() || undefined,
      });

      // Track analytics on first load
      if (currentPage === 1 && dashboards.length > 0) {
        DashboardLibraryInteractions.loaded({
          numberOfItems: dashboards.length,
          contentKinds: ['community_dashboard'],
          datasourceTypes: [ds.type],
          sourceEntryPoint: 'datasource_page',
          eventLocation: 'suggested_dashboards_modal_community_tab',
        });
      }

      return {
        dashboards,
        datasourceType: ds.type,
      };
    } catch (err) {
      console.error('Error loading community dashboards', err);
      throw err;
    }
  }, [datasourceUid, currentPage, debouncedSearchQuery]);

  const styles = useStyles2(getStyles);

  // Determine what to show in results area
  const dashboards = Array.isArray(response?.dashboards) ? response.dashboards : [];
  const hasMore = dashboards.length >= COMMUNITY_PAGE_SIZE;
  const estimatedTotalPages = hasMore ? currentPage + COMMUNITY_PAGINATION_OFFSET : currentPage;
  const showEmptyState = !loading && (!response?.dashboards || response.dashboards.length === 0);
  const showError = !loading && error;

  const onUseCommunityDashboard = async (dashboard: GnetDashboard) => {
    if (response) {
      DashboardLibraryInteractions.itemClicked({
        contentKind: 'community_dashboard',
        datasourceTypes: [response.datasourceType],
        libraryItemId: String(dashboard.id),
        libraryItemTitle: dashboard.name,
        sourceEntryPoint: 'datasource_page',
        eventLocation: 'suggested_dashboards_modal_community_tab',
      });
    }

    try {
      // Fetch full dashboard from Gcom, this is the JSON with __inputs
      const fullDashboard = await fetchCommunityDashboard(dashboard.id);
      const dashboardJson = fullDashboard.json;

      // Parse datasource requirements from __inputs
      const dsInputs: DataSourceInput[] = dashboardJson.__inputs?.filter(isDataSourceInput) || [];

      // Parse constant inputs - these always need user review
      const constantInputs = parseConstantInputs(dashboardJson.__inputs || []);

      // Try auto-mapping datasources, considering we could come from "build dashhoard" there should be a datasource
      // instance selected
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

  return (
    <Stack direction="column" gap={2}>
      <FilterInput
        className={styles.searchInput}
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
            {Array.from({ length: COMMUNITY_PAGE_SIZE }).map((_, i) => (
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
            <Button variant="secondary" onClick={() => setCurrentPage(1)}>
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

              return (
                <DashboardCard
                  key={dashboard.id}
                  title={dashboard.name}
                  imageUrl={imageUrl}
                  dashboard={dashboard}
                  onClick={() => onUseCommunityDashboard(dashboard)}
                  isLogo={isLogo}
                  details={details}
                  buttonText={<Trans i18nKey="dashboard-library.card.use-dashboard-button">Use dashboard</Trans>}
                />
              );
            })}
          </Grid>
        )}
      </div>
      {(hasMore || currentPage > 1) && (
        <Box justifyContent="flex-end">
          <Pagination
            currentPage={currentPage}
            numberOfPages={estimatedTotalPages}
            onNavigate={(page) => setCurrentPage(page)}
            className={styles.pagination}
          />
        </Box>
      )}
    </Stack>
  );
};

function getStyles(theme: GrafanaTheme2) {
  return {
    resultsContainer: css({
      width: '100%',
      minHeight: '600px',
      position: 'relative',
    }),
    pagination: css({
      position: 'sticky',
      bottom: 0,
      backgroundColor: theme.colors.background.primary,
      padding: theme.spacing(2),
      alignItems: 'center',
      zIndex: 2,
    }),
    searchInput: css({
      paddingLeft: theme.spacing(2),
      paddingRight: theme.spacing(2),
    }),
  };
}
