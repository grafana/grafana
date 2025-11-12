import { store } from '@grafana/data';
import { config } from '@grafana/runtime';
import { getDatasourceTypes } from 'app/features/dashboard/dashgrid/DashboardLibrary/utils/dashboardLibraryHelpers';

import { DashboardScene } from '../scene/DashboardScene';
import { EditableDashboardElementInfo } from '../scene/types/EditableDashboardElement';

import { DashboardInteractions } from './interactions';

export function trackDashboardSceneLoaded(dashboard: DashboardScene, duration?: number) {
  const dynamicDashboardsTrackingInformation = dashboard.getDynamicDashboardsTrackingInformation();

  DashboardInteractions.dashboardInitialized({
    theme: undefined,
    duration,
    isScene: true,
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

export const trackDeleteDashboardElement = (element: EditableDashboardElementInfo) => {
  switch (element?.typeName) {
    case 'Row':
      DashboardInteractions.trackRemoveRowClick();
      break;
    case 'Tab':
      DashboardInteractions.trackRemoveTabClick();
      break;
    default:
      break;
  }
};

export const trackDashboardSceneEditButtonClicked = (dashboardUid?: string) => {
  DashboardInteractions.editButtonClicked({
    outlineExpanded: !store.getBool('grafana.dashboard.edit-pane.outline.collapsed', true),
    dashboardUid,
  });
};

export function trackDashboardSceneCreatedOrSaved(
  isNew: boolean,
  dashboard: DashboardScene,
  initialProperties: { name: string; url: string; expression_types?: string[] }
) {
  // url values for dashboard library experiment
  const urlParams = new URLSearchParams(window.location.search);
  const sourceEntryPoint = urlParams.get('sourceEntryPoint') || undefined;
  // For community dashboards, use gnetId as libraryItemId if libraryItemId is not present
  const libraryItemId = urlParams.get('libraryItemId') || urlParams.get('gnetId') || undefined;
  const creationOrigin = urlParams.get('creationOrigin') || undefined;

  // Extract datasourceTypes from dashboard panels
  const datasourceTypes = getDatasourceTypes(dashboard);
  const dynamicDashboardsTrackingInformation = dashboard.getDynamicDashboardsTrackingInformation();

  const dashboardLibraryProperties =
    config.featureToggles.dashboardLibrary || config.featureToggles.dashboardTemplates
      ? {
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
          uid: dashboard.state.uid,
          numPanels: dynamicDashboardsTrackingInformation.panelCount,
          conditionalRenderRules: dynamicDashboardsTrackingInformation.conditionalRenderRulesCount,
          autoLayoutCount: dynamicDashboardsTrackingInformation.autoLayoutCount,
          customGridLayoutCount: dynamicDashboardsTrackingInformation.customGridLayoutCount,
          panelsByDatasourceType: dynamicDashboardsTrackingInformation.panelsByDatasourceType,
          ...dashboardLibraryProperties,
        }
      : {
          ...dashboardLibraryProperties,
        }),
  });
}
