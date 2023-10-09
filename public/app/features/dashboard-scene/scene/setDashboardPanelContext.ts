import { AnnotationEventUIModel, CoreApp, DataFrame } from '@grafana/data';
import { VizPanel } from '@grafana/scenes';
import { AdHocFilterItem, PanelContext } from '@grafana/ui';

export function setDashboardPanelContext(vizPanel: VizPanel, context: PanelContext) {
  context.canAddAnnotations = () => true;

  context.app = CoreApp.Dashboard;

  context.canAddAnnotations = () => {
    // TODO
    return true;
  };

  context.canEditAnnotations = (dashboardUID?: string) => {
    // TODO
    return false;
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
