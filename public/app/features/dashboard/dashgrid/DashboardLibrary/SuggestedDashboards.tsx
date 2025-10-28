import { css } from '@emotion/css';
import { useMemo } from 'react';
import { useAsync } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { getBackendSrv, getDataSourceSrv, locationService } from '@grafana/runtime';
import { Button, useStyles2, Grid } from '@grafana/ui';
import { DataSourceInput } from 'app/features/manage-dashboards/state/reducers';
import { PluginDashboard } from 'app/types/plugins';
import dashboardLibrary1 from 'img/dashboard-library/dashboard_library_1.jpg';
import dashboardLibrary2 from 'img/dashboard-library/dashboard_library_2.jpg';
import dashboardLibrary3 from 'img/dashboard-library/dashboard_library_3.jpg';
import dashboardLibrary4 from 'img/dashboard-library/dashboard_library_4.jpg';
import dashboardLibrary5 from 'img/dashboard-library/dashboard_library_5.jpg';
import dashboardLibrary6 from 'img/dashboard-library/dashboard_library_6.jpg';

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
  datasourceUid?: string;
  onOpenModal: () => void;
  onShowMapping: (context: MappingContext) => void;
}

type MixedDashboard =
  | { type: 'provisioned'; dashboard: PluginDashboard; index: number }
  | { type: 'community'; dashboard: GnetDashboard };

export const SuggestedDashboards = ({ datasourceUid, onOpenModal, onShowMapping }: Props) => {
  const styles = useStyles2(getStyles);

  // Get datasource name for dynamic title
  const datasourceName = useMemo(() => {
    if (!datasourceUid) {
      return '';
    }
    const ds = getDataSourceSrv().getInstanceSettings(datasourceUid);
    return ds?.name || '';
  }, [datasourceUid]);

  const { value: suggestedDashboards, loading } = useAsync(async (): Promise<MixedDashboard[]> => {
    if (!datasourceUid) {
      return [];
    }

    const ds = getDataSourceSrv().getInstanceSettings(datasourceUid);
    if (!ds) {
      return [];
    }

    try {
      // Fetch both provisioned and community dashboards in parallel
      const [provisionedResult, communityResult] = await Promise.all([
        // Fetch provisioned dashboards
        getBackendSrv()
          .get(`api/plugins/${ds.type}/dashboards`, undefined, undefined, {
            showErrorAlert: false,
          })
          .catch((): PluginDashboard[] => []),

        // Fetch community dashboards
        (async () => {
          const params = new URLSearchParams({
            orderBy: 'downloads',
            direction: 'desc',
            page: '1',
            pageSize: '2',
            includeScreenshots: 'true',
          });

          // Filter by datasource type
          if (ds.type) {
            params.append('dataSourceSlugIn', ds.type);
          }

          const result = await getBackendSrv()
            .get(`/api/gnet/dashboards?${params}`, undefined, undefined, {
              showErrorAlert: false,
            })
            .catch((error) => {
              console.error('Error fetching community dashboards:', error);
              return { dashboards: [] };
            });

          // Handle different response structures - API returns {items: [...], total, pages, ...}
          const dashboards = Array.isArray(result) ? result : result.items || result.dashboards || [];
          return dashboards;
        })(),
      ]);

      const provisioned: PluginDashboard[] = Array.isArray(provisionedResult) ? provisionedResult : [];
      let community: GnetDashboard[] = Array.isArray(communityResult) ? communityResult : [];

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
        });
      }

      return mixed;
    } catch (error) {
      console.error('Error loading suggested dashboards', error);
      return [];
    }
  }, [datasourceUid]);

  const handleProvisionedClick = (dashboard: PluginDashboard) => {
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

    window.location.href = `/dashboard/template?${params.toString()}`;
  };

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

  const handleCommunityClick = async (dashboard: GnetDashboard) => {
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
    });

    try {
      // Fetch full dashboard from Gcom, this is the JSON with __inputs
      const fullDashboard = await getBackendSrv().get(`/api/gnet/dashboards/${dashboard.id}`);
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

  const getThumbnailUrl = (dashboard: GnetDashboard) => {
    const thumbnail = dashboard.screenshots?.[0]?.links.find((l: Link) => l.rel === 'image')?.href ?? '';
    return thumbnail ? `/api/gnet${thumbnail}` : '';
  };

  const getLogoUrl = (dashboard: GnetDashboard) => {
    const logo = dashboard.logos?.large || dashboard.logos?.small;
    if (logo?.content && logo?.type) {
      return `data:${logo.type};base64,${logo.content}`;
    }
    return '';
  };

  const getCommunityImageUrl = (dashboard: GnetDashboard) => {
    return getThumbnailUrl(dashboard) || getLogoUrl(dashboard);
  };

  const hasScreenshot = (dashboard: GnetDashboard) => {
    return !!getThumbnailUrl(dashboard);
  };

  const getProvisionedImageUrl = (index: number) => {
    const images = [
      dashboardLibrary1,
      dashboardLibrary2,
      dashboardLibrary3,
      dashboardLibrary4,
      dashboardLibrary5,
      dashboardLibrary6,
    ];
    return images[index % images.length];
  };

  // Don't render if no dashboards or still loading
  if (!loading && (!suggestedDashboards || suggestedDashboards.length === 0)) {
    return null;
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerText}>
          <h1 className={styles.title}>
            {datasourceName
              ? t(
                  'dashboard.empty.suggested-dashboards-title-with-datasource',
                  'Build a dashboard using suggested options for your {{datasourceName}} data source',
                  { datasourceName }
                )
              : t(
                  'dashboard.empty.suggested-dashboards-title',
                  'Build a dashboard using suggested options for your selected data source'
                )}
          </h1>
          <p className={styles.subtitle}>
            <Trans i18nKey="dashboard.empty.suggested-dashboards-subtitle">
              Browse and select from data-source provided or community dashboards
            </Trans>
          </p>
        </div>
        <Button variant="secondary" fill="outline" onClick={onOpenModal} size="sm">
          <Trans i18nKey="dashboard.empty.view-all">View all</Trans>
        </Button>
      </div>

      <Grid
        gap={4}
        columns={{
          xs: 1,
          sm: suggestedDashboards && suggestedDashboards.length >= 2 ? 2 : 1,
          lg: suggestedDashboards && suggestedDashboards.length >= 3 ? 3 : suggestedDashboards?.length >= 2 ? 2 : 1,
        }}
      >
        {loading ? (
          // Show 3 skeleton cards while loading
          <>
            <div className={styles.skeleton} />
            <div className={styles.skeleton} />
            <div className={styles.skeleton} />
          </>
        ) : (
          (suggestedDashboards?.map((item, idx) => {
            if (item.type === 'provisioned') {
              return (
                <DashboardCard
                  key={`provisioned-${item.dashboard.uid}-${idx}`}
                  title={item.dashboard.title}
                  imageUrl={getProvisionedImageUrl(item.index)}
                  dashboard={item.dashboard}
                  onClick={() => handleProvisionedClick(item.dashboard)}
                />
              );
            } else {
              const imageUrl = getCommunityImageUrl(item.dashboard);
              const isLogo = !hasScreenshot(item.dashboard);

              // Format details for community dashboard
              const formatDate = (dateString?: string) => {
                if (!dateString) {
                  return 'N/A';
                }
                const date = new Date(dateString);
                return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
              };

              // Create slug from dashboard name for Grafana.com URL
              const createSlug = (name: string) => {
                return name
                  .toLowerCase()
                  .replace(/[^a-z0-9]+/g, '-')
                  .replace(/^-+|-+$/g, '');
              };

              const grafanaComUrl = `https://grafana.com/grafana/dashboards/${item.dashboard.id}-${createSlug(item.dashboard.name)}/`;

              const details = {
                id: String(item.dashboard.id),
                datasource: item.dashboard.datasource || 'N/A',
                dependencies: item.dashboard.datasource ? [item.dashboard.datasource] : [],
                publishedBy: item.dashboard.orgName || item.dashboard.userName || 'Grafana Community',
                lastUpdate: formatDate(item.dashboard.updatedAt || item.dashboard.publishedAt),
                grafanaComUrl,
              };

              return (
                <DashboardCard
                  key={`community-${item.dashboard.id}-${idx}`}
                  title={item.dashboard.name}
                  imageUrl={imageUrl}
                  dashboard={item.dashboard}
                  onClick={() => handleCommunityClick(item.dashboard)}
                  isLogo={isLogo}
                  details={details}
                />
              );
            }
          }) ?? null)
        )}
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
      marginBottom: theme.spacing(3),
      gap: theme.spacing(2),
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
    skeleton: css({
      height: '400px',
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
  };
}
