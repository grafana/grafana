import { css } from '@emotion/css';
import { useMemo } from 'react';
import { useAsync } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { getDataSourceSrv } from '@grafana/runtime';
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
  onOpenModal: () => void;
  onShowMapping: (context: MappingContext) => void;
}

type MixedDashboard =
  | { type: 'provisioned'; dashboard: PluginDashboard; index: number }
  | { type: 'community'; dashboard: GnetDashboard };

// Constants for suggested dashboards API params
const SUGGESTED_COMMUNITY_PAGE_SIZE = 2;
const DEFAULT_SORT_ORDER = 'downloads';
const DEFAULT_SORT_DIRECTION = 'desc';
const INCLUDE_SCREENSHOTS = true;
const INCLUDE_LOGO = true;

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
      const [provisioned, community] = await Promise.all([
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
          sm: (suggestedDashboards?.length ?? 0) >= 2 ? 2 : 1,
          lg: (suggestedDashboards?.length ?? 0) >= 3 ? 3 : (suggestedDashboards?.length ?? 0) >= 2 ? 2 : 1,
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
          suggestedDashboards?.map((item, idx) => {
            if (item.type === 'provisioned') {
              return (
                <DashboardCard
                  key={`provisioned-${item.dashboard.uid}-${idx}`}
                  title={item.dashboard.title}
                  imageUrl={getProvisionedDashboardImageUrl(item.index)}
                  dashboard={item.dashboard}
                  onClick={() => handleProvisionedClick(item.dashboard)}
                  showDatasourceProvidedBadge={true}
                  dimThumbnail={true}
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
                  onClick={() => handleCommunityClick(item.dashboard)}
                  isLogo={isLogo}
                  details={details}
                />
              );
            }
          }) || []
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
