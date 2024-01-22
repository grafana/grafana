import React from 'react';

import { AnnotationQuery, DataTopic, PageLayoutType } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { SceneComponentProps, SceneDataLayerProvider, SceneObjectBase, sceneGraph } from '@grafana/scenes';
import { Page } from 'app/core/components/Page/Page';

import { DashboardScene } from '../scene/DashboardScene';
import { NavToolbarActions } from '../scene/NavToolbarActions';
import { dataLayersToAnnotations } from '../serialization/dataLayersToAnnotations';
import { getDashboardSceneFor } from '../utils/utils';

import { AnnotationSettingsList } from './annotations';
import { DashboardEditView, DashboardEditViewState, useDashboardEditPageNav } from './utils';

export interface AnnotationsEditViewState extends DashboardEditViewState {
  editIndex?: number | null;
}

export class AnnotationsEditView extends SceneObjectBase<AnnotationsEditViewState> implements DashboardEditView {
  public getUrlKey(): string {
    return 'annotations';
  }

  constructor(state: AnnotationsEditViewState) {
    super({
      ...state,
      editIndex: null,
    });

    this.addActivationHandler(() => {
      this.setState({ editIndex: this.getEditIndex() });
    });
  }

  private get _dashboard(): DashboardScene {
    return getDashboardSceneFor(this);
  }

  private get _dataLayers(): SceneDataLayerProvider[] {
    return sceneGraph.getDataLayers(this._dashboard);
  }

  private getEditIndex() {
    const searchObject = locationService.getSearchObject();

    if (searchObject.editIndex !== undefined) {
      return Number(searchObject.editIndex);
    }

    return null;
  }

  public getAnnotationsLength(): number {
    return this._dataLayers.filter((layer) => layer.topic === DataTopic.Annotations).length;
  }

  public getDashboard(): DashboardScene {
    return this._dashboard;
  }

  public getAnnotations(): AnnotationQuery[] {
    return dataLayersToAnnotations(sceneGraph.getDataLayers(this._dashboard));
  }

  public onNew = () => {
    console.log('todo');
  };

  public onEdit = (idx: number) => {
    console.log('todo');
  };

  static Component = ({ model }: SceneComponentProps<AnnotationsEditView>) => {
    const dashboard = model.getDashboard();
    const annotations = model.getAnnotations();
    const { editIndex } = model.useState();
    const { navModel, pageNav } = useDashboardEditPageNav(dashboard, model.getUrlKey());

    const isEditing = editIndex != null && editIndex < model.getAnnotationsLength();
    console.log(editIndex);

    return (
      <Page navModel={navModel} pageNav={pageNav} layout={PageLayoutType.Standard}>
        <NavToolbarActions dashboard={dashboard} />
        {!isEditing && <AnnotationSettingsList annotations={annotations} onNew={model.onNew} onEdit={model.onEdit} />}
      </Page>
    );
  };
}
