import { AnnotationQuery, getDataSourceRef, NavModel, NavModelItem, PageLayoutType } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';
import { SceneComponentProps, SceneObjectBase, VizPanel, dataLayers } from '@grafana/scenes';
import { Page } from 'app/core/components/Page/Page';

import { DashboardAnnotationsDataLayer } from '../scene/DashboardAnnotationsDataLayer';
import { DashboardScene } from '../scene/DashboardScene';
import { NavToolbarActions } from '../scene/NavToolbarActions';
import { dataLayersToAnnotations } from '../serialization/dataLayersToAnnotations';
import { dashboardSceneGraph } from '../utils/dashboardSceneGraph';
import { getDashboardSceneFor } from '../utils/utils';

import { EditListViewSceneUrlSync } from './EditListViewSceneUrlSync';
import { AnnotationSettingsEdit, AnnotationSettingsList, newAnnotationName } from './annotations';
import { DashboardEditView, DashboardEditViewState, useDashboardEditPageNav } from './utils';

export enum MoveDirection {
  UP = -1,
  DOWN = 1,
}

export interface AnnotationsEditViewState extends DashboardEditViewState {
  editIndex?: number | undefined;
}

export class AnnotationsEditView extends SceneObjectBase<AnnotationsEditViewState> implements DashboardEditView {
  static Component = AnnotationsSettingsView;

  public getUrlKey(): string {
    return 'annotations';
  }

  protected _urlSync = new EditListViewSceneUrlSync(this);

  private get _dashboard(): DashboardScene {
    return getDashboardSceneFor(this);
  }

  public getDataLayer(editIndex: number): dataLayers.AnnotationsDataLayer {
    const data = dashboardSceneGraph.getDataLayers(this._dashboard);
    const layer = data.state.annotationLayers[editIndex];

    if (!(layer instanceof dataLayers.AnnotationsDataLayer)) {
      throw new Error('AnnotationsDataLayer not found at index ' + editIndex);
    }

    return layer;
  }

  public getDashboard(): DashboardScene {
    return this._dashboard;
  }

  public getDataSourceRefForAnnotation = () => {
    // get current default datasource ref from instance settings
    // null is passed to get the default datasource
    const defaultInstanceDS = getDataSourceSrv().getInstanceSettings(null);
    // check for an annotation flag in the plugin json to see if it supports annotations
    if (!defaultInstanceDS || !defaultInstanceDS.meta.annotations) {
      console.error('Default datasource does not support annotations');
      return undefined;
    }
    return getDataSourceRef(defaultInstanceDS);
  };

  public onNew = async () => {
    const newAnnotationQuery: AnnotationQuery = {
      name: newAnnotationName,
      enable: true,
      datasource: this.getDataSourceRefForAnnotation(),
      iconColor: 'red',
    };

    const newAnnotation = new DashboardAnnotationsDataLayer({
      query: newAnnotationQuery,
      name: newAnnotationQuery.name,
      isEnabled: Boolean(newAnnotationQuery.enable),
      isHidden: Boolean(newAnnotationQuery.hide),
    });

    const data = dashboardSceneGraph.getDataLayers(this._dashboard);

    data.addAnnotationLayer(newAnnotation);
    this.setState({ editIndex: data.state.annotationLayers.length - 1 });
  };

  public onEdit = (idx: number) => {
    this.setState({ editIndex: idx });
  };

  public onBackToList = () => {
    this.setState({ editIndex: undefined });
  };

  public onMove = (idx: number, direction: MoveDirection) => {
    const data = dashboardSceneGraph.getDataLayers(this._dashboard);
    const layers = [...data.state.annotationLayers];

    const [layer] = layers.splice(idx, 1);
    layers.splice(idx + direction, 0, layer);

    data.setState({ annotationLayers: layers });
  };

  public onDelete = (idx: number) => {
    const data = dashboardSceneGraph.getDataLayers(this._dashboard);
    const layers = [...data.state.annotationLayers];

    layers.splice(idx, 1);

    data.setState({ annotationLayers: layers });
  };

  public onUpdate = (annotation: AnnotationQuery, editIndex: number) => {
    const layer = this.getDataLayer(editIndex);

    layer.setState({
      name: annotation.name,
      isEnabled: Boolean(annotation.enable),
      isHidden: Boolean(annotation.hide),
      query: annotation,
    });

    //need to rerun the layer to update the query and
    //see the annotation on the panel
    layer.runLayer();
  };
}

function AnnotationsSettingsView({ model }: SceneComponentProps<AnnotationsEditView>) {
  const dashboard = model.getDashboard();
  const { annotationLayers } = dashboardSceneGraph.getDataLayers(dashboard).useState();
  const { navModel, pageNav } = useDashboardEditPageNav(dashboard, model.getUrlKey());
  const { editIndex } = model.useState();
  const panels = dashboardSceneGraph.getVizPanels(dashboard);

  const annotations: AnnotationQuery[] = dataLayersToAnnotations(annotationLayers);

  if (editIndex != null && editIndex < annotationLayers.length) {
    return (
      <AnnotationsSettingsEditView
        annotationLayer={model.getDataLayer(editIndex)}
        pageNav={pageNav}
        panels={panels}
        editIndex={editIndex}
        navModel={navModel}
        dashboard={dashboard}
        onUpdate={model.onUpdate}
        onBackToList={model.onBackToList}
        onDelete={model.onDelete}
      />
    );
  }

  return (
    <Page navModel={navModel} pageNav={pageNav} layout={PageLayoutType.Standard}>
      <NavToolbarActions dashboard={dashboard} />
      <AnnotationSettingsList
        annotations={annotations}
        onNew={model.onNew}
        onEdit={model.onEdit}
        onDelete={model.onDelete}
        onMove={model.onMove}
      />
    </Page>
  );
}

interface AnnotationsSettingsEditViewProps {
  annotationLayer: dataLayers.AnnotationsDataLayer;
  pageNav: NavModelItem;
  panels: VizPanel[];
  editIndex: number;
  navModel: NavModel;
  dashboard: DashboardScene;
  onUpdate: (annotation: AnnotationQuery, editIndex: number) => void;
  onBackToList: () => void;
  onDelete: (idx: number) => void;
}

function AnnotationsSettingsEditView({
  annotationLayer,
  pageNav,
  navModel,
  panels,
  editIndex,
  dashboard,
  onUpdate,
  onBackToList,
  onDelete,
}: AnnotationsSettingsEditViewProps) {
  const { name, query } = annotationLayer.useState();

  const editAnnotationPageNav = {
    text: name,
    parentItem: pageNav,
  };

  return (
    <Page navModel={navModel} pageNav={editAnnotationPageNav} layout={PageLayoutType.Standard}>
      <NavToolbarActions dashboard={dashboard} />
      <AnnotationSettingsEdit
        annotation={query}
        editIndex={editIndex}
        panels={panels}
        onUpdate={onUpdate}
        onBackToList={onBackToList}
        onDelete={onDelete}
      />
    </Page>
  );
}
