import React from 'react';

import { AnnotationQuery, PageLayoutType, getDataSourceRef } from '@grafana/data';
import { getDataSourceSrv, locationService } from '@grafana/runtime';
import { SceneComponentProps, SceneObjectBase } from '@grafana/scenes';
import { Page } from 'app/core/components/Page/Page';

import { DashboardScene } from '../scene/DashboardScene';
import { NavToolbarActions } from '../scene/NavToolbarActions';
import { getDashboardSceneFor } from '../utils/utils';

import { AnnotationSettingsEdit, AnnotationSettingsList, newAnnotationName } from './annotations';
import { DashboardEditView, DashboardEditViewState, useDashboardEditPageNav } from './utils';

export interface AnnotationsEditViewState extends DashboardEditViewState {}

export class AnnotationsEditView extends SceneObjectBase<AnnotationsEditViewState> implements DashboardEditView {
  public getUrlKey(): string {
    return 'annotations';
  }

  private get _dashboard(): DashboardScene {
    return getDashboardSceneFor(this);
  }

  public getDashboard(): DashboardScene {
    return this._dashboard;
  }

  public getEditIndex() {
    const searchObject = locationService.getSearchObject();

    if (searchObject.editIndex != null && typeof searchObject.editIndex === 'number') {
      return searchObject.editIndex;
    }
    return undefined;
  }

  public onNew = () => {
    const newAnnotation: AnnotationQuery = {
      name: newAnnotationName,
      enable: true,
      datasource: getDataSourceRef(getDataSourceSrv().getInstanceSettings(null)!),
      iconColor: 'red',
    };

    this._dashboard.setState({
      annotations: {
        list: [...this._dashboard.state.annotations.list, { ...newAnnotation }],
      },
    });

    locationService.partial({ editIndex: this._dashboard.state.annotations.list.length - 1 });
  };

  public onEdit = (idx: number) => {
    locationService.partial({ editIndex: idx });
  };

  static Component = ({ model }: SceneComponentProps<AnnotationsEditView>) => {
    const dashboard = model.getDashboard();
    const { navModel, pageNav } = useDashboardEditPageNav(dashboard, model.getUrlKey());
    const editIndex = model.getEditIndex();

    const isEditing = editIndex != null && editIndex < dashboard.state.annotations.list.length;

    return (
      <Page navModel={navModel} pageNav={pageNav} layout={PageLayoutType.Standard}>
        <NavToolbarActions dashboard={dashboard} />
        {!isEditing && <AnnotationSettingsList dashboard={dashboard} onNew={model.onNew} onEdit={model.onEdit} />}
        {isEditing && <AnnotationSettingsEdit dashboard={dashboard} editIdx={editIndex!} />}
      </Page>
    );
  };
}
