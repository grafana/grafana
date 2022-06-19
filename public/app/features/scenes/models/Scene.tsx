import React from 'react';

import { PageToolbar, ToolbarButton } from '@grafana/ui';

import { SceneObjectBase } from './SceneObjectBase';
import { SceneComponentProps, SceneObjectState, SceneObject } from './types';

interface SceneState extends SceneObjectState {
  title: string;
  layout: SceneObject<any>;
  actions?: Array<SceneObject<any>>;
  isEditing?: boolean;
}

export class Scene extends SceneObjectBase<SceneState> {
  static Component = SceneRenderer;
}

function SceneRenderer({ model }: SceneComponentProps<Scene>) {
  const { title, layout, $timeRange, actions = [], isEditing, $editor } = model.useMount().useState();

  console.log('render scene');

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
        {$timeRange && <$timeRange.Component model={$timeRange} />}
      </PageToolbar>
      <div style={{ flexGrow: 1, display: 'flex', padding: '16px', gap: '8px', paddingTop: 0, overflow: 'auto' }}>
        <layout.Component model={layout} isEditing={isEditing} />
        {$editor && <$editor.Component model={$editor} isEditing={isEditing} />}
      </div>
    </div>
  );
}
