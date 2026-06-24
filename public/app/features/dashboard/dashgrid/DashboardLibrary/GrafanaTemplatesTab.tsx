import { type MutableRefObject, useEffect } from 'react';

import { type DataSourceInstanceSettings } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import {
  useFlagAnalyticsFramework,
  useFlagAssistantFrontendToolsDashboardTemplates,
  useFlagDashboardTemplatesAssistantButton,
} from '@grafana/runtime/internal';
import { Grid } from '@grafana/ui';

import { DashboardCard } from './DashboardCard';
import { NewTemplateDashboardInteractions } from './analytics/main';
import {
  CONTENT_KINDS,
  DashboardTemplatesSourceEntryPointMap,
  DISCOVERY_METHODS,
  EVENT_LOCATIONS,
  TemplateDashboardSourceEntryPoint,
} from './constants';
import { TemplateDashboardInteractions } from './interactions';
import { type GnetDashboard, type Link } from './types';
import { getTemplateDashboardUrl } from './utils/templateDashboardHelpers';

interface GrafanaTemplatesTabProps {
  dashboards: GnetDashboard[];
  loading: boolean;
  /** Raw `source` search param value, mapped to a known entry point when fired. */
  entryPoint: string;
  testDataSource: DataSourceInstanceSettings | undefined;
  onClose: () => void;
  /**
   * Once-per-open guard owned by the parent modal. It lives in the parent because this
   * component unmounts when the user switches to another tab — a local ref would reset
   * and the `loaded` event would re-fire when the user returns to this tab.
   */
  loadedFiredRef: MutableRefObject<boolean>;
}

export const GrafanaTemplatesTab = ({
  dashboards,
  loading,
  entryPoint,
  testDataSource,
  onClose,
  loadedFiredRef,
}: GrafanaTemplatesTabProps) => {
  const isDashboardTemplatesAssistantButtonEnabled = useFlagDashboardTemplatesAssistantButton();
  const isDashboardTemplatesAssistantToolEnabled = useFlagAssistantFrontendToolsDashboardTemplates();
  const isAnalyticsFrameworkEnabled = useFlagAnalyticsFramework();

  const showGrafanaTemplates = testDataSource && (dashboards.length > 0 || loading);

  // Fire `loaded` once per open, after templates resolve. Mounting this component means
  // the Grafana templates tab is the selected view, so this tracks tab selection.
  useEffect(() => {
    if (loadedFiredRef.current || loading || dashboards.length === 0) {
      return;
    }
    loadedFiredRef.current = true;
    const properties = {
      numberOfItems: dashboards.length,
      contentKinds: [CONTENT_KINDS.TEMPLATE_DASHBOARD],
      datasourceTypes: [String(testDataSource?.type)],
      sourceEntryPoint: DashboardTemplatesSourceEntryPointMap[entryPoint] || 'unknown',
      eventLocation: EVENT_LOCATIONS.BROWSE_DASHBOARDS_PAGE,
    };
    isAnalyticsFrameworkEnabled
      ? NewTemplateDashboardInteractions.loaded(properties)
      : TemplateDashboardInteractions.loaded(properties);
  }, [loading, dashboards, entryPoint, testDataSource?.type, isAnalyticsFrameworkEnabled, loadedFiredRef]);

  const onPreviewDashboardClick = async (dashboard: GnetDashboard, customizeWithAssistant = false) => {
    const sourceEntryPoint = DashboardTemplatesSourceEntryPointMap[entryPoint] || 'unknown';
    isAnalyticsFrameworkEnabled
      ? NewTemplateDashboardInteractions.itemClicked({
          contentKind: CONTENT_KINDS.TEMPLATE_DASHBOARD,
          datasourceTypes: [String(testDataSource?.type)],
          libraryItemId: String(dashboard.id),
          libraryItemTitle: dashboard.name,
          sourceEntryPoint,
          eventLocation: EVENT_LOCATIONS.BROWSE_DASHBOARDS_PAGE,
          discoveryMethod: DISCOVERY_METHODS.BROWSE,
          action: customizeWithAssistant ? 'assistant' : 'view_template',
        })
      : TemplateDashboardInteractions.itemClicked({
          contentKind: CONTENT_KINDS.TEMPLATE_DASHBOARD,
          datasourceTypes: [String(testDataSource?.type)],
          libraryItemId: String(dashboard.id),
          libraryItemTitle: dashboard.name,
          sourceEntryPoint,
          eventLocation: EVENT_LOCATIONS.BROWSE_DASHBOARDS_PAGE,
          discoveryMethod: DISCOVERY_METHODS.BROWSE,
          action: customizeWithAssistant ? 'assistant' : 'view_template',
        });

    const templateUrl = getTemplateDashboardUrl(
      dashboard,
      sourceEntryPoint,
      customizeWithAssistant ? TemplateDashboardSourceEntryPoint.ASSISTANT_BUTTON : undefined
    );
    locationService.push(templateUrl);
  };

  if (!showGrafanaTemplates) {
    return null;
  }

  return (
    <Grid
      gap={4}
      columns={{
        xs: 1,
        sm: 2,
        lg: 3,
      }}
    >
      {loading
        ? Array.from({ length: 4 }).map((_, index) => <DashboardCard.Skeleton key={index} />)
        : dashboards?.map((dashboard) => {
            const thumbnail = dashboard.screenshots?.[0]?.links.find((l: Link) => l.rel === 'image')?.href ?? '';
            const thumbnailUrl = thumbnail ? `/api/gnet${thumbnail}` : '';

            return (
              <DashboardCard
                key={dashboard.id}
                title={dashboard.name}
                imageUrl={thumbnailUrl}
                onClick={(customizeWithAssistant?: boolean) =>
                  onPreviewDashboardClick(dashboard, customizeWithAssistant)
                }
                onClose={onClose}
                dashboard={dashboard}
                kind="template_dashboard"
                showAssistantButton={
                  isDashboardTemplatesAssistantButtonEnabled && isDashboardTemplatesAssistantToolEnabled
                }
              />
            );
          })}
    </Grid>
  );
};
