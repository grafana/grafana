import { AnnotationEventUIModel, CoreApp, DataFrame } from '@grafana/data';
import { dataLayers, SceneDataLayers, VizPanel } from '@grafana/scenes';
import { AdHocFilterItem, PanelContext } from '@grafana/ui';

import { getDashboardSceneFor } from '../utils/utils';

export function setDashboardPanelContext(vizPanel: VizPanel, context: PanelContext) {
  context.app = CoreApp.Dashboard;

  context.canAddAnnotations = () => {
    const dashboard = getDashboardSceneFor(vizPanel);
    let hasBuiltInAnnotations = false;

    // When there is no builtin annotations query we disable the ability to add annotations
    if (dashboard.state.$data instanceof SceneDataLayers) {
      for (const layer of dashboard.state.$data.state.layers) {
        if (layer instanceof dataLayers.AnnotationsDataLayer) {
          if (layer.state.isEnabled && layer.state.query.builtIn) {
            hasBuiltInAnnotations = true;
          }
        }
      }
    }

    if (!hasBuiltInAnnotations || !dashboard.canEditDashboard()) {
      return false;
    }

    // If RBAC is enabled there are additional conditions to check.
    return Boolean(dashboard.state.meta.annotationsPermissions?.dashboard.canAdd);
  };

  context.canEditAnnotations = (dashboardUID?: string) => {
    const dashboard = getDashboardSceneFor(vizPanel);

    if (!dashboard.canEditDashboard()) {
      return false;
    }

    // dashboardUID is falsy when it is an organizational annotation
    if (!dashboardUID) {
      return Boolean(dashboard.state.meta.annotationsPermissions?.organization.canEdit);
    }

    return Boolean(dashboard.state.meta.annotationsPermissions?.dashboard.canEdit);
  };

  context.canDeleteAnnotations = (dashboardUID?: string) => {
    // TODO
    return false;
  };

  context.onAnnotationCreate = (event: AnnotationEventUIModel) => {
    // TODO
  };

  context.onAnnotationUpdate = (event: AnnotationEventUIModel) => {
    // TODO
  };

  context.onAnnotationDelete = (id: string) => {
    // TODO
  };

  context.onAddAdHocFilter = (item: AdHocFilterItem) => {
    // TODO
  };

  context.onUpdateData = (frames: DataFrame[]): Promise<boolean> => {
    // TODO
    //return onUpdatePanelSnapshotData(this.props.panel, frames);
    return Promise.resolve(true);
  };
}
