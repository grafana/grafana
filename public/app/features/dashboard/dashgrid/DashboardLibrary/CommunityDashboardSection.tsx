import { css } from '@emotion/css';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom-v5-compat';
import { useAsync, useDebounce } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { getBackendSrv, getDataSourceSrv, locationService } from '@grafana/runtime';
import { Button, useStyles2, Stack, Grid, EmptyState, Alert, Pagination, FilterInput } from '@grafana/ui';
import { DataSourceInput } from 'app/features/manage-dashboards/state/reducers';

import { DASHBOARD_LIBRARY_ROUTES } from '../types';

import { DashboardCard } from './DashboardCard';
import { MappingContext } from './DashboardLibraryModal';
import { DashboardLibraryInteractions } from './interactions';
import { GnetDashboard, Link } from './types';
import {
  tryAutoMapDatasources,
  parseConstantInputs,
  InputMapping,
  isDataSourceInput,
} from './utils/autoMapDatasources';

interface Props {
  onShowMapping: (context: MappingContext) => void;
  datasourceType?: string;
}

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
    500,
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
      const params = new URLSearchParams({
        orderBy: 'downloads',
        direction: 'desc',
        page: String(currentPage),
        pageSize: '9',
        includeLogo: '1',
        includeScreenshots: 'true',
      });

      // Filter by datasource type using dataSourceSlugIn
      if (ds.type) {
        params.append('dataSourceSlugIn', ds.type);
      }

      // Add search query using filter parameter
      if (debouncedSearchQuery.trim()) {
        params.append('filter', debouncedSearchQuery.trim());
      }

      const result = await getBackendSrv().get(`/api/gnet/dashboards?${params}`, undefined, undefined, {
        showErrorAlert: false,
      });

      // The API response might have different structures - handle both
      let dashboards: GnetDashboard[];
      if (Array.isArray(result)) {
        dashboards = result;
      } else if (result && Array.isArray(result.dashboards)) {
        dashboards = result.dashboards;
      } else if (result && Array.isArray(result.items)) {
        dashboards = result.items;
      } else {
        console.warn('Unexpected API response format:', result);
        dashboards = [];
      }

      // Track analytics on first load
      if (currentPage === 1 && dashboards.length > 0) {
        DashboardLibraryInteractions.loaded({
          numberOfItems: dashboards.length,
          contentKinds: ['community_dashboard'],
          datasourceTypes: [ds.type],
          sourceEntryPoint: 'datasource_page',
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
  const hasMore = dashboards.length >= 9;
  const estimatedTotalPages = hasMore ? currentPage + 4 : currentPage;
  const showEmptyState = !loading && (!response?.dashboards || response.dashboards.length === 0);
  const showError = !loading && error;

  const navigateToTemplate = (dashboardTitle: string, gnetId: number, mappings: InputMapping[]) => {
    // Navigate to template route with mappings in URL
    // Backend will fetch from Grafana.com and interpolate server-side
    const searchParams = new URLSearchParams({
      datasource: datasourceUid || '',
      title: dashboardTitle,
      gnetId: String(gnetId),
      sourceEntryPoint: 'datasource_page',
      creationOrigin: 'dashboard_library_community_dashboard',
      // Encode mappings as JSON in URL
      mappings: JSON.stringify(mappings),
    });

    locationService.push({
      pathname: DASHBOARD_LIBRARY_ROUTES.Template,
      search: searchParams.toString(),
    });
  };

  const onUseDashboard = async (dashboard: GnetDashboard) => {
    if (response) {
      DashboardLibraryInteractions.itemClicked({
        contentKind: 'community_dashboard',
        datasourceTypes: [response.datasourceType],
        libraryItemId: String(dashboard.id),
        libraryItemTitle: dashboard.name,
        sourceEntryPoint: 'datasource_page',
      });
    }

    try {
      // Fetch full dashboard from Gcom, this is the JSON with __inputs
      const fullDashboard = await getBackendSrv().get(`/api/gnet/dashboards/${dashboard.id}`);
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
        navigateToTemplate(dashboard.name, dashboard.id, mappingResult.mappings);
      } else {
        // Show mapping form for unmapped datasources and/or constants
        onShowMapping({
          dashboardName: dashboard.name,
          dashboardJson,
          unmappedInputs: mappingResult.unmappedInputs,
          constantInputs,
          existingMappings: mappingResult.mappings,
          onInterpolateAndNavigate: (mappings) => navigateToTemplate(dashboard.name, dashboard.id, mappings),
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
        placeholder={
          datasourceType
            ? t(
                'dashboard.library.community-search-placeholder-with-datasource',
                'Search {{datasourceType}} community dashboards...',
                { datasourceType }
              )
            : t('dashboard.library.community-search-placeholder', 'Search community dashboards...')
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
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className={styles.skeleton} />
            ))}
          </Grid>
        ) : showError ? (
          <Stack direction="column" alignItems="center" gap={2}>
            <Alert
              title={t('dashboard.library.community-error-title', 'Error loading community dashboards')}
              severity="error"
            >
              <Trans i18nKey="dashboard.library.community-error">
                Failed to load community dashboards. Please try again.
              </Trans>
            </Alert>
            <Button variant="secondary" onClick={() => setCurrentPage(1)}>
              <Trans i18nKey="dashboard.library.retry">Retry</Trans>
            </Button>
          </Stack>
        ) : showEmptyState ? (
          <EmptyState
            variant="call-to-action"
            message={
              datasourceType
                ? t(
                    'dashboard.library.community-empty-title-with-datasource',
                    'No {{datasourceType}} community dashboards found',
                    { datasourceType }
                  )
                : t('dashboard.library.community-empty-title', 'No community dashboards found')
            }
            button={
              <Button
                variant="secondary"
                onClick={() => window.open('https://grafana.com/grafana/dashboards/', '_blank')}
              >
                <Trans i18nKey="dashboard.library.browse-grafana-com">Browse Grafana.com</Trans>
              </Button>
            }
          >
            {searchQuery && !datasourceType ? (
              <Trans i18nKey="dashboard.library.no-community-dashboards-search">
                Try a different search term or browse more dashboards on Grafana.com.
              </Trans>
            ) : (
              <Trans i18nKey="dashboard.library.no-community-dashboards-datasource">
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
              const getThumbnailUrl = () => {
                const thumbnail = dashboard.screenshots?.[0]?.links.find((l: Link) => l.rel === 'image')?.href ?? '';
                return thumbnail ? `/api/gnet${thumbnail}` : '';
              };

              const getLogoUrl = () => {
                const logo = dashboard.logos?.large || dashboard.logos?.small;
                if (logo?.content && logo?.type) {
                  return `data:${logo.type};base64,${logo.content}`;
                }
                return '';
              };

              const thumbnailUrl = getThumbnailUrl();
              const logoUrl = getLogoUrl();
              const imageUrl = thumbnailUrl || logoUrl;
              const isLogo = !thumbnailUrl;

              // Format details for community dashboard
              const formatDate = (dateString?: string) => {
                if (!dateString) {
                  return 'N/A';
                }
                const date = new Date(dateString);
                return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
              };

              const details = {
                id: String(dashboard.id),
                datasource: dashboard.datasource || 'N/A',
                dependencies: dashboard.datasource ? [dashboard.datasource] : [],
                publishedBy: dashboard.orgName || dashboard.userName || 'Grafana Community',
                lastUpdate: formatDate(dashboard.updatedAt || dashboard.publishedAt),
              };

              return (
                <DashboardCard
                  key={dashboard.id}
                  title={dashboard.name}
                  imageUrl={imageUrl}
                  dashboard={dashboard}
                  onClick={() => onUseDashboard(dashboard)}
                  isLogo={isLogo}
                  details={details}
                />
              );
            })}
          </Grid>
        )}
      </div>
      {(hasMore || currentPage > 1) && (
        <Pagination
          currentPage={currentPage}
          numberOfPages={estimatedTotalPages}
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
      minHeight: '600px',
      position: 'relative',
    }),
    skeleton: css({
      height: '300px',
      backgroundColor: theme.colors.background.secondary,
      borderRadius: theme.shape.radius.default,
      [theme.transitions.handleMotion('no-preference')]: {
        animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      '@keyframes pulse': {
        '0%, 100%': {
          opacity: 1,
        },
        '50%': {
          opacity: 0.5,
        },
      },
    }),
    pagination: css({
      position: 'sticky',
      bottom: 0,
      backgroundColor: theme.colors.background.primary,
      paddingTop: theme.spacing(2),
      paddingBottom: theme.spacing(1),
      marginTop: theme.spacing(2),
      alignItems: 'center',
      zIndex: 2,
    }),
  };
}
