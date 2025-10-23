import { css } from '@emotion/css';
import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom-v5-compat';
import { useAsync, useDebounce } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { getBackendSrv, getDataSourceSrv, locationService } from '@grafana/runtime';
import {
  Button,
  useStyles2,
  Stack,
  Grid,
  EmptyState,
  Alert,
  LoadingPlaceholder,
  Pagination,
  FilterInput,
  Card,
  Tooltip,
} from '@grafana/ui';
import { DataSourceInput } from 'app/features/manage-dashboards/state/reducers';
import { DashboardJson } from 'app/features/manage-dashboards/types';

import { DASHBOARD_LIBRARY_ROUTES } from '../types';

import { MappingContext } from './DashboardLibraryModal';
import { DashboardLibraryInteractions } from './interactions';
import {
  tryAutoMapDatasources,
  parseConstantInputs,
  InputMapping,
  isDataSourceInput,
} from './utils/autoMapDatasources';

interface Link {
  rel: string;
  href: string;
}

interface Screenshot {
  links: Link[];
}

interface LogoImage {
  content: string;
  filename: string;
  type: string;
}

interface Logo {
  small?: LogoImage;
  large?: LogoImage;
}

interface GnetDashboard {
  id: number;
  uid: string;
  name: string;
  description: string;
  downloads: number;
  datasource: string;
  screenshots?: Screenshot[];
  logos?: Logo;
  json?: DashboardJson; // Full dashboard JSON from detail API
}

interface Props {
  onShowMapping: (context: MappingContext) => void;
}

export const CommunityDashboardSection = ({ onShowMapping }: Props) => {
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
        pageSize: '10',
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
  const hasMore = dashboards.length >= 10;
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
        placeholder={t('dashboard.library.community-search-placeholder', 'Search community dashboards...')}
        value={searchQuery}
        onChange={setSearchQuery}
      />

      <div className={styles.resultsContainer}>
        {loading && currentPage === 1 && !response ? (
          <div className={styles.loadingOverlay}>
            <LoadingPlaceholder text={t('dashboard.library.community-loading', 'Loading community dashboards...')} />
          </div>
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
            message={t('dashboard.library.community-empty-title', 'No community dashboards found')}
            button={
              <Button
                variant="secondary"
                onClick={() => window.open('https://grafana.com/grafana/dashboards/', '_blank')}
              >
                <Trans i18nKey="dashboard.library.browse-grafana-com">Browse Grafana.com</Trans>
              </Button>
            }
          >
            {searchQuery ? (
              <Trans i18nKey="dashboard.library.no-community-dashboards-search">
                No community dashboards found for your search. You can browse more dashboards on Grafana.com.
              </Trans>
            ) : (
              <Trans i18nKey="dashboard.library.no-community-dashboards-datasource">
                No community dashboards found for this datasource. You can browse more dashboards on Grafana.com.
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
            {dashboards.map((dashboard) => (
              <CommunityDashboardCard key={dashboard.id} dashboard={dashboard} onUseDashboard={onUseDashboard} />
            ))}
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

const CommunityDashboardCard = ({
  dashboard,
  onUseDashboard,
}: {
  dashboard: GnetDashboard;
  onUseDashboard: (d: GnetDashboard) => void;
}) => {
  const styles = useStyles2(getStyles);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

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
  const hasScreenshot = !!thumbnailUrl;

  return (
    <Card onClick={() => onUseDashboard(dashboard)} className={styles.card} noMargin>
      <Card.Heading>{dashboard.name}</Card.Heading>
      <div className={hasScreenshot ? styles.thumbnailContainer : styles.logoContainer}>
        {imageUrl && !imageError ? (
          <>
            {!imageLoaded && <LoadingPlaceholder text="" />}
            <img
              src={imageUrl}
              alt={dashboard.name}
              className={hasScreenshot ? styles.thumbnail : styles.logo}
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageError(true)}
              style={{ display: imageLoaded ? 'block' : 'none' }}
            />
          </>
        ) : null}
      </div>
      <div title={dashboard.description || ''} className={styles.descriptionWrapper}>
        {dashboard.description && (
          <Card.Description className={styles.description}>{dashboard.description}</Card.Description>
        )}
      </div>

      <Card.Actions>
        <Button
          variant="secondary"
          onClick={(e) => {
            e.stopPropagation();
            onUseDashboard(dashboard);
          }}
          size="sm"
        >
          <Trans i18nKey="dashboard.empty.use-template-button">Use this dashboard</Trans>
        </Button>
      </Card.Actions>
    </Card>
  );
};

function getStyles(theme: GrafanaTheme2) {
  return {
    resultsContainer: css({
      width: '100%',
      minHeight: '600px',
      position: 'relative',
    }),
    loadingOverlay: css({
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.background.canvas,
      zIndex: 1,
    }),
    card: css({
      gridTemplateAreas: `
        "Heading"
        "Thumbnail"
        "Description"
        "Actions"`,
      gridTemplateRows: 'auto 200px auto auto',
      height: '320px',
    }),
    thumbnailContainer: css({
      gridArea: 'Thumbnail',
      width: '100%',
      height: '100%',
      overflow: 'hidden',
      borderRadius: theme.shape.radius.default,
      backgroundColor: theme.colors.background.secondary,
      marginTop: theme.spacing(1),
      marginBottom: theme.spacing(1),
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }),
    thumbnail: css({
      width: '100%',
      height: '100%',
      objectFit: 'contain',
    }),
    logoContainer: css({
      gridArea: 'Thumbnail',
      width: '100%',
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: theme.shape.radius.default,
      backgroundColor: theme.colors.background.secondary,
      marginTop: theme.spacing(1),
      marginBottom: theme.spacing(1),
    }),
    logo: css({
      maxWidth: '100px',
      maxHeight: '100px',
      objectFit: 'contain',
    }),
    descriptionWrapper: css({
      gridArea: 'Description',
      cursor: 'help',
    }),
    description: css({
      display: '-webkit-box',
      WebkitLineClamp: 2,
      WebkitBoxOrient: 'vertical',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      margin: 0,
    }),
    pagination: css({
      marginTop: theme.spacing(2),
      alignItems: 'center',
    }),
  };
}
