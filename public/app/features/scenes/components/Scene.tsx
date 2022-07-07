import React from 'react';

import { PageToolbar, ToolbarButton } from '@grafana/ui';

import { SceneObjectBase } from '../core/SceneObjectBase';
import { SceneComponentProps, SceneObjectState, SceneObject } from '../core/types';
import { UrlSyncManager } from '../services/UrlSyncManager';

interface SceneState extends SceneObjectState {
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

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', flex: '1 1 0', minHeight: 0 }}>
      <PageToolbar title={title}>
        {actions.map((action) => (
          <action.Component key={action.state.key} model={action} />
        ))}
        {$editor && (
          <ToolbarButton
            icon="cog"
            variant={isEditing ? 'primary' : 'default'}
            onClick={() => model.setState({ isEditing: !model.state.isEditing })}
          />
        )}
      </PageToolbar>
      <div style={{ flexGrow: 1, display: 'flex', padding: '16px', gap: '8px', paddingTop: 0, overflow: 'auto' }}>
        <layout.Component model={layout} isEditing={isEditing} />
        {$editor && <$editor.Component model={$editor} isEditing={isEditing} />}
      </div>
    </div>
  );
}
