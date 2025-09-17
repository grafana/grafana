import { store } from '@grafana/data';

import { DashboardInteractions } from './interactions';

export const trackDashboardSceneEditButtonClicked = () => {
  const outlineExpandedByDefault = !store.getBool('grafana.dashboard.edit-pane.outline.collapsed', true);
  DashboardInteractions.editButtonClicked({
    outlineExpanded: outlineExpandedByDefault,
  });
};
