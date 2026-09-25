import { lazy, Suspense } from 'react';

import { type AnnotationQuery, getDataSourceRef } from '@grafana/data';
import { getDataSourceInstanceSettings } from '@grafana/runtime/unstable';
import { type SceneComponentProps, SceneObjectBase, dataLayers } from '@grafana/scenes';
import { Spinner } from '@grafana/ui';

import { DashboardAnnotationsDataLayer } from '../scene/DashboardAnnotationsDataLayer';
import { NEW_ANNOTATION_NAME } from '../scene/DashboardDataLayerSet';
import { type DashboardScene } from '../scene/DashboardScene';
import { dashboardSceneGraph } from '../utils/dashboardSceneGraph';
import { getDashboardSceneFor } from '../utils/utils';

import { EditListViewSceneUrlSync } from './EditListViewSceneUrlSync';
import { type DashboardEditView, type DashboardEditViewState } from './utils';

const AnnotationsEditViewRenderer = lazy(() =>
  import('./SettingsRenderers').then((m) => ({ default: m.AnnotationsEditViewRenderer }))
);

function LazyAnnotationsEditViewRenderer(props: SceneComponentProps<AnnotationsEditView>) {
  return (
    <Suspense fallback={<Spinner />}>
      <AnnotationsEditViewRenderer {...props} />
    </Suspense>
  );
}

export enum MoveDirection {
  UP = -1,
  DOWN = 1,
}

export interface AnnotationsEditViewState extends DashboardEditViewState {
  editIndex?: number | undefined;
}

export class AnnotationsEditView extends SceneObjectBase<AnnotationsEditViewState> implements DashboardEditView {
  static Component = LazyAnnotationsEditViewRenderer;

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

  public getDataSourceRefForAnnotation = async () => {
    // get current default datasource ref from instance settings
    // null is passed to get the default datasource
    const defaultInstanceDS = await getDataSourceInstanceSettings(null);
    // check for an annotation flag in the plugin json to see if it supports annotations
    if (!defaultInstanceDS || !defaultInstanceDS.meta.annotations) {
      console.error('Default datasource does not support annotations');
      return undefined;
    }
    return getDataSourceRef(defaultInstanceDS);
  };

  public onNew = async () => {
    const newAnnotationQuery: AnnotationQuery = {
      name: NEW_ANNOTATION_NAME,
      enable: true,
      datasource: await this.getDataSourceRefForAnnotation(),
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
      placement: annotation.placement,
      query: annotation,
    });

    //need to rerun the layer to update the query and
    //see the annotation on the panel
    layer.runLayer();
  };
}
