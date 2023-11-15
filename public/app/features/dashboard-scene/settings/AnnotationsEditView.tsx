import React from 'react';

import { PageLayoutType } from '@grafana/data';
import { SceneComponentProps, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { Page } from 'app/core/components/Page/Page';

import { NavToolbarActions } from '../scene/NavToolbarActions';
import { getDashboardSceneFor } from '../utils/utils';

import { DashboardEditView, useDashboardEditPageNav } from './DashboardEditView';
import { GeneralSettings } from './GeneralSettings';

export interface AnnotationsEditViewState extends SceneObjectState {}

export class AnnotationsEditView extends SceneObjectBase<AnnotationsEditViewState> implements DashboardEditView {
  public getUrlKey(): string {
    return 'annotations';
  }

  static Component = ({ model }: SceneComponentProps<GeneralSettings>) => {
    const dashboard = getDashboardSceneFor(model);
    const { navModel, pageNav } = useDashboardEditPageNav(dashboard, model.getUrlKey());

    return (
      <Page navModel={navModel} pageNav={pageNav} layout={PageLayoutType.Standard}>
        <NavToolbarActions dashboard={dashboard} />
        <div>Annotations todo</div>
      </Page>
    );
  };
}
