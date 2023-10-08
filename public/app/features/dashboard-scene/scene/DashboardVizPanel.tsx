import { AnnotationEventUIModel, CoreApp, DataFrame } from '@grafana/data';
import { SceneComponent, VizPanel } from '@grafana/scenes';
import { AdHocFilterItem } from '@grafana/ui';

export class DashboardVizPanel extends VizPanel {
  protected override buildPanelContext() {
    const panelContext = super.buildPanelContext();

    panelContext.app = CoreApp.Dashboard;
    panelContext.canAddAnnotations = this._canAddAnnotations.bind(this);
    panelContext.canEditAnnotations = this._canEditAnnotations.bind(this);
    panelContext.canDeleteAnnotations = this._canDeleteAnnotations.bind(this);
    panelContext.onAnnotationCreate = this._onAnnotationCreate.bind(this);
    panelContext.onAnnotationUpdate = this._onAnnotationUpdate.bind(this);
    panelContext.onAnnotationDelete = this._onAnnotationDelete.bind(this);
    panelContext.onAddAdHocFilter = this._onAddAdHocFilter.bind(this);
    panelContext.onUpdateData = this._onUpdateData.bind(this);

    return panelContext;
  }

  private _canAddAnnotations() {
    // TODO copy implementation from DashboardModel.canAddAnnotations
    return true;
  }

  private _canEditAnnotations(dashboardUID?: string) {
    // TODO
    return false;
  }

  private _canDeleteAnnotations(dashboardUID?: string) {
    // TODO
    return false;
  }

  private _onAnnotationCreate(event: AnnotationEventUIModel) {
    console.log('on annotation create', event);
    // TODO
  }

  private _onAnnotationUpdate(event: AnnotationEventUIModel) {
    console.log('on annotation create', event);
    // TODO
  }

  private _onAnnotationDelete(id: string) {
    console.log('on annotation create', event);
    // TODO
  }

  private _onAddAdHocFilter(item: AdHocFilterItem) {
    // Here I need the this panels query runner's data source.
    // So it's very useful that this is bound to this panel instance.
    console.log('on add adhoc filter', item);
  }

  private _onUpdateData(frames: DataFrame[]): Promise<boolean> {
    // TODO
    //return onUpdatePanelSnapshotData(this.props.panel, frames);
    return Promise.resolve(true);
  }
}
