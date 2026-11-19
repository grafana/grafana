import { type MutableRefObject, useEffect } from 'react';
import { useAsync } from 'react-use';

import { type DataSourceInstanceListItem, locationUtil } from '@grafana/data';
import { t } from '@grafana/i18n';
import { getBackendSrv, locationService } from '@grafana/runtime';
import {
  useFlagAnalyticsFramework,
  useFlagAssistantFrontendToolsDashboardTemplates,
  useFlagDashboardTemplatesAssistantButton,
} from '@grafana/runtime/internal';
import { EmptyState, Grid } from '@grafana/ui';

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
import { type GnetDashboard, type GnetDashboardsResponse, type Link, type TemplateSelectionProps } from './types';
import { buildOpenTemplateContextItem } from './utils/assistantHelpers';
import { getTemplateDashboardUrl } from './utils/templateDashboardHelpers';
import { filterTemplates } from './utils/templateFilters';

interface GrafanaTemplatesTabProps extends TemplateSelectionProps {
  /** Raw `source` search param value, mapped to a known entry point when fired. */
  entryPoint: string;
  testDataSource: DataSourceInstanceListItem | undefined;
  onClose: () => void;
  /**
   * Once-per-open guard owned by the parent modal. It lives in the parent because this
   * component unmounts when the user switches to another tab — a local ref would reset
   * and the `loaded` event would re-fire when the user returns to this tab.
   */
  loadedFiredRef: MutableRefObject<boolean>;
}

export const GrafanaTemplatesTab = ({
  entryPoint,
  testDataSource,
  onClose,
  loadedFiredRef,
  onSelectTemplate,
  selectedTemplateId,
  onTemplatesLoad,
  searchQuery,
  sortOrder,
}: GrafanaTemplatesTabProps) => {
  const isDashboardTemplatesAssistantButtonEnabled = useFlagDashboardTemplatesAssistantButton();
  const isDashboardTemplatesAssistantToolEnabled = useFlagAssistantFrontendToolsDashboardTemplates();
  const isAnalyticsFrameworkEnabled = useFlagAnalyticsFramework();

  const { value: dashboards = [], loading } = useAsync(async () => {
    try {
      const response = await getBackendSrv().get<GnetDashboardsResponse>(
        `/api/gnet/dashboards?orgSlug=raintank&categorySlug=templates&includeScreenshots=true`,
        undefined,
        undefined,
        {
          showErrorAlert: false,
        }
      );

      return response.items;
    } catch (error) {
      console.error('Error loading template dashboards ', error);
      return [];
    }
  }, []);

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

  useEffect(() => {
    if (!loading) {
      onTemplatesLoad?.(dashboards.length);
    }
  }, [loading, dashboards.length, onTemplatesLoad]);

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
      testDataSource,
      sourceEntryPoint,
      customizeWithAssistant ? TemplateDashboardSourceEntryPoint.ASSISTANT_BUTTON : undefined
    );
    locationService.push(templateUrl);
  };

  const sourceEntryPoint = DashboardTemplatesSourceEntryPointMap[entryPoint] || 'unknown';

  // A new tab keeps the landing, and its prompt, where the person left them.
  const previewTemplate = (dashboard: GnetDashboard) => {
    const url = getTemplateDashboardUrl(dashboard, testDataSource, sourceEntryPoint);
    window.open(locationUtil.assureBaseUrl(url), '_blank', 'noopener,noreferrer');
  };

  const selectTemplate = (dashboard: GnetDashboard) => {
    onSelectTemplate?.({
      id: getGrafanaTemplateSelectionId(dashboard),
      kind: 'template_dashboard',
      // The page Customize with Assistant opens: the template's own dashboard, on TestData.
      url: getTemplateDashboardUrl(
        dashboard,
        testDataSource,
        sourceEntryPoint,
        TemplateDashboardSourceEntryPoint.ASSISTANT_BUTTON
      ),
      contextItem: buildOpenTemplateContextItem({
        name: dashboard.name,
        description: dashboard.description,
        author: dashboard.orgName || dashboard.userName,
      }),
    });
  };

  // Without a test data source there is nothing to power the templates, so render nothing.
  if (!testDataSource) {
    return null;
  }

  if (!onSelectTemplate && !loading && dashboards.length === 0) {
    return (
      <EmptyState
        variant="not-found"
        message={t(
          'dashboard-library.grafana-dashboard-template-modal.no-results-found',
          'No template dashboards found'
        )}
      />
    );
  }

  const shownDashboards = filterTemplates(
    dashboards,
    (dashboard) => dashboard.name,
    (dashboard) => dashboard.description,
    searchQuery,
    sortOrder
  );

  const cards = loading
    ? Array.from({ length: 4 }).map((_, index) => (
        <DashboardCard.Skeleton key={index} fluid={Boolean(onSelectTemplate)} />
      ))
    : shownDashboards.map((dashboard) => {
        const thumbnail = dashboard.screenshots?.[0]?.links.find((l: Link) => l.rel === 'image')?.href ?? '';
        const thumbnailUrl = thumbnail ? `/api/gnet${thumbnail}` : '';

        return (
          <DashboardCard
            key={dashboard.id}
            title={dashboard.name}
            imageUrl={thumbnailUrl}
            onClick={(customizeWithAssistant?: boolean) => onPreviewDashboardClick(dashboard, customizeWithAssistant)}
            onClose={onClose}
            dashboard={dashboard}
            kind="template_dashboard"
            showAssistantButton={isDashboardTemplatesAssistantButtonEnabled && isDashboardTemplatesAssistantToolEnabled}
            onSelect={onSelectTemplate ? () => selectTemplate(dashboard) : undefined}
            onPreview={onSelectTemplate ? () => previewTemplate(dashboard) : undefined}
            selected={selectedTemplateId === getGrafanaTemplateSelectionId(dashboard)}
          />
        );
      });

  // A picker renders bare cards: the caller lays out every template source in one grid.
  if (onSelectTemplate) {
    return <>{cards}</>;
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
      {cards}
    </Grid>
  );
};

function getGrafanaTemplateSelectionId(dashboard: GnetDashboard): string {
  return `grafana:${dashboard.id}`;
}
