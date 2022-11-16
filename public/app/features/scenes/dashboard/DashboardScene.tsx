import React from 'react';

import { PageLayoutType } from '@grafana/data';
import { config } from '@grafana/runtime';
import { PageToolbar } from '@grafana/ui';
import { AppChromeUpdate } from 'app/core/components/AppChrome/AppChromeUpdate';
import { Page } from 'app/core/components/Page/Page';

import { SceneObjectBase } from '../core/SceneObjectBase';
import { SceneComponentProps, SceneLayout, SceneObject, SceneObjectStatePlain } from '../core/types';

interface DashboardSceneState extends SceneObjectStatePlain {
  title: string;
  layout: SceneLayout;
  actions?: SceneObject[];
}

export class DashboardScene extends SceneObjectBase<DashboardSceneState> {
  public static Component = DashboardSceneRenderer;
}

function DashboardSceneRenderer({ model }: SceneComponentProps<DashboardScene>) {
  const { title, layout, actions = [] } = model.useState();

  const toolbarActions = (actions ?? []).map((action) => <action.Component key={action.state.key} model={action} />);

  const pageToolbar = config.featureToggles.topnav ? (
    <AppChromeUpdate actions={toolbarActions} />
  ) : (
    <PageToolbar title={title}>{toolbarActions}</PageToolbar>
  );

  return (
    <Page navId="scenes" pageNav={{ text: title }} layout={PageLayoutType.Canvas} toolbar={pageToolbar}>
      <div style={{ flexGrow: 1, display: 'flex', gap: '8px', overflow: 'auto' }}>
        <layout.Component model={layout} />
      </div>
    </Page>
  );
}
