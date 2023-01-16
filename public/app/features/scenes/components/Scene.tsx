import React from 'react';

import { PageLayoutType } from '@grafana/data';
import { config } from '@grafana/runtime';
import { SceneObjectBase, SceneComponentProps, SceneState, UrlSyncManager } from '@grafana/scenes';
import { PageToolbar, ToolbarButton } from '@grafana/ui';
import { AppChromeUpdate } from 'app/core/components/AppChrome/AppChromeUpdate';
import { Page } from 'app/core/components/Page/Page';

export class Scene extends SceneObjectBase<SceneState> {
  public static Component = SceneRenderer;
  private urlSyncManager?: UrlSyncManager;

  public activate() {
    super.activate();
    this.urlSyncManager = new UrlSyncManager(this);
    this.urlSyncManager.initSync();
  }

  public deactivate() {
    super.deactivate();
    this.urlSyncManager!.cleanUp();
  }
}

function SceneRenderer({ model }: SceneComponentProps<Scene>) {
  const { title, body, actions = [], isEditing, $editor, subMenu } = model.useState();

  const toolbarActions = (actions ?? []).map((action) => <action.Component key={action.state.key} model={action} />);

  if ($editor) {
    toolbarActions.push(
      <ToolbarButton
        key="scene-settings"
        icon="cog"
        variant={isEditing ? 'primary' : 'default'}
        onClick={() => model.setState({ isEditing: !model.state.isEditing })}
      />
    );
  }

  const pageToolbar = config.featureToggles.topnav ? (
    <AppChromeUpdate actions={toolbarActions} />
  ) : (
    <PageToolbar title={title}>{toolbarActions}</PageToolbar>
  );

  return (
    <Page navId="scenes" pageNav={{ text: title }} layout={PageLayoutType.Canvas} toolbar={pageToolbar}>
      <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {subMenu && <subMenu.Component model={subMenu} />}
        <div style={{ flexGrow: 1, display: 'flex', gap: '8px', overflow: 'auto' }}>
          <body.Component model={body} isEditing={isEditing} />
          {$editor && <$editor.Component model={$editor} isEditing={isEditing} />}
        </div>
      </div>
    </Page>
  );
}
