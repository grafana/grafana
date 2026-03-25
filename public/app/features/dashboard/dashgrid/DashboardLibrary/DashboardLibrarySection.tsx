import { css } from '@emotion/css';
import { useBooleanFlagValue } from '@openfeature/react-sdk';
import { useEffect, useMemo, useRef, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { getDataSourceSrv, locationService } from '@grafana/runtime';
import { useStyles2, Stack, Grid, Pagination, EmptyState, Button } from '@grafana/ui';
import { PluginDashboard } from 'app/types/plugins';

import { DASHBOARD_LIBRARY_ROUTES } from '../types';

import { DashboardCard } from './DashboardCard';
import { NewDashboardLibraryInteractions } from './analytics/main';
import { CONTENT_KINDS, CREATION_ORIGINS, DISCOVERY_METHODS, EVENT_LOCATIONS, SOURCE_ENTRY_POINTS } from './constants';
import { DashboardLibraryInteractions } from './interactions';
import { getProvisionedDashboardImageUrl } from './utils/provisionedDashboardHelpers';

// Constants for datasource-provided dashboards pagination
const PAGE_SIZE = 9;

interface DashboardLibrarySectionProps {
  dashboards: PluginDashboard[];
  datasourceUid?: string;
  isDashboardsLoading: boolean;
}

export const DashboardLibrarySection = ({
  dashboards,
  datasourceUid,
  isDashboardsLoading,
}: DashboardLibrarySectionProps) => {
  const [currentPage, setCurrentPage] = useState(1);
  const hasTrackedLoaded = useRef(false);

  const isAnalyticsFrameworkEnabled = useBooleanFlagValue('analyticsFramework', true);

  // Get datasource info for empty state
  const datasourceType = useMemo(() => {
    if (!datasourceUid) {
      return '';
    }
    const ds = getDataSourceSrv().getInstanceSettings(datasourceUid);
    return ds?.type || '';
  }, [datasourceUid]);

  // Track analytics only once on first successful load
  useEffect(() => {
    if (!isDashboardsLoading && !hasTrackedLoaded.current && dashboards.length > 0) {
      isAnalyticsFrameworkEnabled
        ? NewDashboardLibraryInteractions.loaded({
            numberOfItems: dashboards.length,
            contentKinds: [CONTENT_KINDS.DATASOURCE_DASHBOARD],
            datasourceTypes: [datasourceType],
            sourceEntryPoint: SOURCE_ENTRY_POINTS.DATASOURCE_PAGE,
            eventLocation: EVENT_LOCATIONS.MODAL_PROVISIONED_TAB,
          })
        : DashboardLibraryInteractions.loaded({
            numberOfItems: dashboards.length,
            contentKinds: [CONTENT_KINDS.DATASOURCE_DASHBOARD],
            datasourceTypes: [datasourceType],
            sourceEntryPoint: SOURCE_ENTRY_POINTS.DATASOURCE_PAGE,
            eventLocation: EVENT_LOCATIONS.MODAL_PROVISIONED_TAB,
          });
      hasTrackedLoaded.current = true;
    }
  }, [isDashboardsLoading, dashboards, datasourceType, isAnalyticsFrameworkEnabled]);

  // Calculate pagination
  const totalPages = Math.ceil(dashboards.length / PAGE_SIZE);
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const endIndex = startIndex + PAGE_SIZE;
  const dashboardsToShow = dashboards?.slice(startIndex, endIndex) ?? [];

  const styles = useStyles2(getStyles);

  const showEmptyState = !isDashboardsLoading && dashboards.length === 0;

  const onUseProvisionedDashboard = async (dashboard: PluginDashboard) => {
    isAnalyticsFrameworkEnabled
      ? NewDashboardLibraryInteractions.itemClicked({
          contentKind: CONTENT_KINDS.DATASOURCE_DASHBOARD,
          datasourceTypes: [dashboard.pluginId],
          libraryItemId: dashboard.uid,
          libraryItemTitle: dashboard.title,
          sourceEntryPoint: SOURCE_ENTRY_POINTS.DATASOURCE_PAGE,
          eventLocation: EVENT_LOCATIONS.MODAL_PROVISIONED_TAB,
          discoveryMethod: DISCOVERY_METHODS.BROWSE,
        })
      : DashboardLibraryInteractions.itemClicked({
          contentKind: CONTENT_KINDS.DATASOURCE_DASHBOARD,
          datasourceTypes: [dashboard.pluginId],
          libraryItemId: dashboard.uid,
          libraryItemTitle: dashboard.title,
          sourceEntryPoint: SOURCE_ENTRY_POINTS.DATASOURCE_PAGE,
          eventLocation: EVENT_LOCATIONS.MODAL_PROVISIONED_TAB,
          discoveryMethod: DISCOVERY_METHODS.BROWSE,
        });

    const params = new URLSearchParams({
      datasource: datasourceUid || '',
      title: dashboard.title || 'Template',
      pluginId: dashboard.pluginId,
      path: dashboard.path,
      suggestedDashboardBanner: 'true',
      // tracking event purpose values
      sourceEntryPoint: SOURCE_ENTRY_POINTS.DATASOURCE_PAGE,
      libraryItemId: dashboard.uid,
      creationOrigin: CREATION_ORIGINS.DASHBOARD_LIBRARY_DATASOURCE_DASHBOARD,
      eventLocation: EVENT_LOCATIONS.MODAL_PROVISIONED_TAB,
      contentKind: CONTENT_KINDS.DATASOURCE_DASHBOARD,
    });

    const templateUrl = `${DASHBOARD_LIBRARY_ROUTES.Template}?${params.toString()}`;
    locationService.push(templateUrl);
  };

  return (
    <Stack direction="column" gap={2} justifyContent="space-between" height="100%">
      {showEmptyState ? (
        <EmptyState
          variant="call-to-action"
          message={
            datasourceType
              ? t(
                  'dashboard-library.provisioned-empty-title-with-datasource',
                  'No {{datasourceType}} provisioned dashboards found',
                  { datasourceType }
                )
              : t('dashboard-library.provisioned-empty-title', 'No provisioned dashboards found')
          }
          button={
            <Button variant="secondary" onClick={() => window.open('https://grafana.com/grafana/plugins/', '_blank')}>
              <Trans i18nKey="dashboard-library.browse-plugins">Browse plugins</Trans>
            </Button>
          }
        >
          <Trans i18nKey="dashboard-library.no-provisioned-dashboards">
            Provisioned dashboards are provided by data source plugins. You can find more plugins on Grafana.com.
          </Trans>
        </EmptyState>
      ) : (
        <Grid
          gap={4}
          columns={{
            xs: 1,
            sm: isDashboardsLoading ? 2 : (dashboardsToShow.length || 1) >= 2 ? 2 : 1,
            lg: isDashboardsLoading
              ? 3
              : (dashboardsToShow.length || 1) >= 3
                ? 3
                : (dashboardsToShow.length || 1) >= 2
                  ? 2
                  : 1,
          }}
        >
          {isDashboardsLoading
            ? Array.from({ length: 9 }).map((_, i) => <DashboardCard.Skeleton key={`skeleton-${i}`} />)
            : dashboardsToShow.map((dashboard, index) => {
                const globalIndex = startIndex + index;
                const imageUrl = getProvisionedDashboardImageUrl(globalIndex);

                return (
                  <DashboardCard
                    key={dashboard.uid}
                    title={dashboard.title}
                    imageUrl={imageUrl}
                    dashboard={dashboard}
                    onClick={() => onUseProvisionedDashboard(dashboard)}
                    kind="suggested_dashboard"
                  />
                );
              })}
        </Grid>
      )}
      {!showEmptyState && totalPages > 1 && (
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
    pagination: css({
      position: 'sticky',
      bottom: 0,
      backgroundColor: theme.colors.background.primary,
      padding: theme.spacing(2),
      alignItems: 'center',
      zIndex: 2,
    }),
  };
}
