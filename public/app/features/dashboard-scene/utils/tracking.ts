import { store } from '@grafana/data';

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
  const dynamicDashboardsTrackingInformation = dashboard.getDynamicDashboardsTrackingInformation();

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
        }
      : {}),
  });
}
