import { store } from '@grafana/data';

import { DashboardScene } from '../scene/DashboardScene';
import { DashboardTrackingInfo, DashboardV2TrackingInfo } from '../serialization/DashboardSceneSerializer';

import { DashboardInteractions } from './interactions';

export const trackDashboardSceneEditButtonClicked = () => {
  const outlineExpandedByDefault = !store.getBool('grafana.dashboard.edit-pane.outline.collapsed', true);
  DashboardInteractions.editButtonClicked({
    outlineExpanded: outlineExpandedByDefault,
  });
};

export interface DashboardCreatedProps {
  name: string;
  url: string;
  [key: string]: unknown;
}

export function trackDashboardSceneCreatedOrSaved(
  name: 'created' | 'saved',
  dashboard: DashboardScene,
  initialProperties: DashboardCreatedProps
) {
  const trackingInformation = dashboard.getTrackingInformation();
  const v2TrackingFields = {
    numPanels: trackingInformation?.panels_count,
    conditionalRenderRules: trackingInformation?.conditionalRenderRulesCount,
    autoLayout: trackingInformation?.autoLayoutCount,
    customGridLayout: trackingInformation?.customGridLayoutCount,
  };

  DashboardInteractions.dashboardCreatedOrSaved(name, {
    ...initialProperties,
    ...v2TrackingFields,
  });
}
