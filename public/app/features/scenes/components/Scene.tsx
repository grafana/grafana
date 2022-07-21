import React from 'react';

import { config } from '@grafana/runtime';
import { PageToolbar, ToolbarButton } from '@grafana/ui';
import { AppChromeUpdate } from 'app/core/components/AppChrome/AppChromeUpdate';
import { Page } from 'app/core/components/Page/Page';
import { PageLayoutType } from 'app/core/components/Page/types';

import { SceneObjectBase } from '../core/SceneObjectBase';
import { SceneComponentProps, SceneObjectStatePlain, SceneObject } from '../core/types';
import { UrlSyncManager } from '../services/UrlSyncManager';

interface SceneState extends SceneObjectStatePlain {
  title: string;
  layout: SceneObject;
  actions?: SceneObject[];
  isEditing?: boolean;
}

export class Scene extends SceneObjectBase<SceneState> {
  static Component = SceneRenderer;
  urlSyncManager?: UrlSyncManager;

  activate() {
    super.activate();
    this.urlSyncManager = new UrlSyncManager(this);
  }

  deactivate() {
    super.deactivate();
    this.urlSyncManager!.cleanUp();
  }
}

function SceneRenderer({ model }: SceneComponentProps<Scene>) {
  const { title, layout, actions = [], isEditing, $editor } = model.useState();

  const toolbarActions = (actions ?? []).map((action) => <action.Component key={action.state.key} model={action} />);

  if ($editor) {
    toolbarActions.push(
      <ToolbarButton
        icon="cog"
        variant={isEditing ? 'primary' : 'default'}
        onClick={() => model.setState({ isEditing: !model.state.isEditing })}
      />
    );
  }

  const pageToolbar = config.featureToggles.topnav ? (
    <AppChromeUpdate pageNav={{ text: title }} actions={toolbarActions} />
  ) : (
    <PageToolbar title={title}>{toolbarActions}</PageToolbar>
  );

  return (
    <Page navId="scenes" layout={PageLayoutType.Dashboard} toolbar={pageToolbar}>
      <div style={{ flexGrow: 1, display: 'flex', gap: '8px', overflow: 'auto' }}>
        <layout.Component model={layout} isEditing={isEditing} />
        {$editor && <$editor.Component model={$editor} isEditing={isEditing} />}
      </div>
    </Page>
  );
}
