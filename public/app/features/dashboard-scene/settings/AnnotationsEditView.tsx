import React from 'react';

import { AnnotationQuery, DataTopic, PageLayoutType, getDataSourceRef } from '@grafana/data';
import { getDataSourceSrv, locationService } from '@grafana/runtime';
import { SceneComponentProps, SceneDataLayers, SceneObjectBase, dataLayers, sceneGraph } from '@grafana/scenes';
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

  public getSceneDataLayers(): SceneDataLayers {
    const data = sceneGraph.getData(this);

    if (!(data instanceof SceneDataLayers)) {
      throw new Error('SceneDataLayers not found');
    }

    return data;
  }

  public getDataLayer(editIndex: number): dataLayers.AnnotationsDataLayer {
    const data = this.getSceneDataLayers();
    const layer = data.state.layers[editIndex];

    if (!(layer instanceof dataLayers.AnnotationsDataLayer)) {
      throw new Error('AnnotationsDataLayer not found at index ' + editIndex);
    }

    return layer;
  }

  public getAnnotationsLength(): number {
    return this.getSceneDataLayers().state.layers.filter((layer) => layer.topic === DataTopic.Annotations).length;
  }

  public getDashboard(): DashboardScene {
    return this._dashboard;
  }

  public onNew = () => {
    const newAnnotationQuery: AnnotationQuery = {
      name: newAnnotationName,
      enable: true,
      datasource: getDataSourceRef(getDataSourceSrv().getInstanceSettings(null)!),
      iconColor: 'red',
    };

    const newAnnotation = new DashboardAnnotationsDataLayer({
      key: `annotations-${newAnnotationQuery.name}`,
      query: newAnnotationQuery,
      name: newAnnotationQuery.name,
      isEnabled: Boolean(newAnnotationQuery.enable),
      isHidden: Boolean(newAnnotationQuery.hide),
    });

    const data = this.getSceneDataLayers();

    const layers = [...data.state.layers];
    newAnnotation.activate();

    //keep annotation layers together
    layers.splice(this.getAnnotationsLength(), 0, newAnnotation);

    data.setState({
      layers,
    });

    this.setState({ editIndex: this.getAnnotationsLength() - 1 });
  };

  public onEdit = (idx: number) => {
    this.setState({ editIndex: idx });
  };

  public goBackToList = () => {
    this.setState({ editIndex: undefined });
  };

  public onPreview = () => {
    this.setState({ editIndex: undefined });

    this._dashboard.stopUrlSync();

    locationService.partial({ editview: null });

    this._dashboard.startUrlSync();
  };

  public onMove = (idx: number, direction: MoveDirection) => {
    const data = this.getSceneDataLayers();

    const layers = [...data.state.layers];
    const [layer] = layers.splice(idx, 1);
    layers.splice(idx + direction, 0, layer);

    data.setState({
      layers,
    });
  };

  public onDelete = (idx: number) => {
    const data = this.getSceneDataLayers();

    const layers = [...data.state.layers];
    layers.splice(idx, 1);

    data.setState({
      layers,
    });
  };

  public onUpdate = (annotation: AnnotationQuery, editIndex: number) => {
    const data = this.getSceneDataLayers();

    const layers = [...data.state.layers];
    const layer = layers[editIndex];

    if (layer instanceof dataLayers.AnnotationsDataLayer) {
      layer.setState({
        key: `annotations-${annotation.name}`,
        name: annotation.name,
        isEnabled: Boolean(annotation.enable),
        isHidden: Boolean(annotation.hide),
        query: annotation,
      });

      //need to rerun the layer to update the query and
      //see the annotation on the panel
      layer.runLayer();
    }
  };
}

function AnnotationsSettingsView({ model }: SceneComponentProps<AnnotationsEditView>) {
  const dashboard = model.getDashboard();
  const { layers } = model.getSceneDataLayers().useState();
  const { navModel, pageNav } = useDashboardEditPageNav(dashboard, model.getUrlKey());
  const { editIndex } = model.useState();
  const panels = dashboardSceneGraph.getVizPanels(dashboard);

  const annotations: AnnotationQuery[] = dataLayersToAnnotations(layers);
  const isEditing = editIndex != null && editIndex < model.getAnnotationsLength();

  return (
    <Page navModel={navModel} pageNav={pageNav} layout={PageLayoutType.Standard}>
      <NavToolbarActions dashboard={dashboard} />
      {!isEditing && (
        <AnnotationSettingsList
          annotations={annotations}
          onNew={model.onNew}
          onEdit={model.onEdit}
          onDelete={model.onDelete}
          onMove={model.onMove}
        />
      )}
      {isEditing && (
        <AnnotationSettingsEdit
          annotationLayer={model.getDataLayer(editIndex)}
          editIndex={editIndex}
          panels={panels}
          onUpdate={model.onUpdate}
          goBackToList={model.goBackToList}
          onDelete={model.onDelete}
          onPreview={model.onPreview}
        />
      )}
    </Page>
  );
}
