import { store } from '@grafana/data';
import { config } from '@grafana/runtime';
import { SceneGridItemLike } from '@grafana/scenes';
import { getDatasourceTypes } from 'app/features/dashboard/dashgrid/DashboardLibrary/utils/dashboardLibraryHelpers';

import { DashboardScene } from '../scene/DashboardScene';
import { AutoGridItem } from '../scene/layout-auto-grid/AutoGridItem';
import { DashboardGridItem } from '../scene/layout-default/DashboardGridItem';

import { DashboardInteractions } from './interactions';

export function trackDashboardSceneLoaded(dashboard: DashboardScene, duration?: number) {
  const dynamicDashboardsTrackingInformation = dashboard.getDynamicDashboardsTrackingInformation();

  DashboardInteractions.dashboardInitialized({
    theme: undefined,
    duration,
    isScene: true,
    hasEditPermissions: dashboard.canEditDashboard(),
    hasSavePermissions: Boolean(dashboard.state.meta.canSave),
    ...(dashboard.getTrackingInformation() ?? {}),
    ...(dynamicDashboardsTrackingInformation
      ? {
          tabCount: dynamicDashboardsTrackingInformation.tabCount,
          templateVariableCount: dynamicDashboardsTrackingInformation.templateVariableCount,
          maxNestingLevel: dynamicDashboardsTrackingInformation.maxNestingLevel,
          dashStructure: dynamicDashboardsTrackingInformation.dashStructure,
          conditionalRenderRules: dynamicDashboardsTrackingInformation.conditionalRenderRulesCount,
          autoLayoutCount: dynamicDashboardsTrackingInformation.autoLayoutCount,
          customGridLayoutCount: dynamicDashboardsTrackingInformation.customGridLayoutCount,
        }
      : {}),
  });
}

export const trackDashboardSceneEditButtonClicked = (dashboardUid?: string) => {
  DashboardInteractions.editButtonClicked({
    outlineExpanded: !store.getBool('grafana.dashboard.edit-pane.outline.collapsed', false),
    dashboardUid,
  });
};

export function trackDashboardSceneCreatedOrSaved(
  isNew: boolean,
  dashboard: DashboardScene,
  initialProperties: {
    name: string;
    url: string;
    transformation_counts?: Record<string, number>;
    expression_counts?: Record<string, number>;
  }
) {
  // url values for dashboard library experiment
  const urlParams = new URLSearchParams(window.location.search);
  const sourceEntryPoint = urlParams.get('sourceEntryPoint') || undefined;
  // For community dashboards, use gnetId as libraryItemId if libraryItemId is not present
  const libraryItemId = urlParams.get('libraryItemId') || urlParams.get('gnetId') || undefined;
  const creationOrigin = urlParams.get('creationOrigin') || undefined;

  // Extract datasourceTypes from URL params (supports both community and provisioned dashboards) or dashboard panels
  const datasourceTypes = getDatasourceTypes(dashboard);

  const sceneDashboardTrackingInfo = dashboard.getTrackingInformation();
  const dynamicDashboardsTrackingInformation = dashboard.getDynamicDashboardsTrackingInformation();

  // Extract variable type counts from tracking info
  const variables = Object.entries(sceneDashboardTrackingInfo ?? {})
    .filter(([key]) => /^variable_type_.+_count$/.test(key))
    .reduce<Record<string, number>>((acc, [key, value]) => {
      acc[key] = value;
      return acc;
    }, {});

  const dashboardLibraryProperties =
    config.featureToggles.dashboardLibrary ||
    config.featureToggles.dashboardTemplates ||
    config.featureToggles.suggestedDashboards
      ? {
          isDashboardTemplatesEnabled: config.featureToggles.dashboardTemplates ?? false,
          datasourceTypes,
          sourceEntryPoint,
          libraryItemId,
          creationOrigin,
        }
      : {};

  DashboardInteractions.dashboardCreatedOrSaved(isNew, {
    ...initialProperties,
    ...(dynamicDashboardsTrackingInformation
      ? {
          uid: dashboard.state.uid || '',
          numPanels: dynamicDashboardsTrackingInformation.panelCount,
          numTabs: dynamicDashboardsTrackingInformation.tabCount,
          numRows: dynamicDashboardsTrackingInformation.rowCount,
          conditionalRenderRules: dynamicDashboardsTrackingInformation.conditionalRenderRulesCount,
          autoLayoutCount: dynamicDashboardsTrackingInformation.autoLayoutCount,
          customGridLayoutCount: dynamicDashboardsTrackingInformation.customGridLayoutCount,
          panelsByDatasourceType: dynamicDashboardsTrackingInformation.panelsByDatasourceType,
          ...variables,
          ...dashboardLibraryProperties,
        }
      : {
          uid: dashboard.state.uid || '',
          numPanels: sceneDashboardTrackingInfo?.panels_count || 0,
          numRows: sceneDashboardTrackingInfo?.rowCount || 0,
          ...variables,
          ...dashboardLibraryProperties,
        }),
  });
}

export function trackDropItemCrossLayout(gridItem: SceneGridItemLike) {
  // only track panels for now
  if (gridItem instanceof AutoGridItem || gridItem instanceof DashboardGridItem) {
    DashboardInteractions.trackMoveItem('panel', 'drop', {
      isCrossLayout: true,
    });
  }
}
