import React from 'react';

import { PageToolbar } from '@grafana/ui';

import { SceneObjectBase } from './SceneObjectBase';
import { SceneComponentProps, SceneObjectState, SceneObject } from './types';

interface SceneState extends SceneObjectState {
  title: string;
  layout: SceneObject<any>;
  actions?: Array<SceneObject<any>>;
  isEditing?: boolean;
}

export class Scene extends SceneObjectBase<SceneState> {
  Component = SceneRenderer;
}

const SceneRenderer = React.memo<SceneComponentProps<Scene>>(({ model }) => {
  const { title, layout, $timeRange, actions = [], isEditing } = model.useMount().useState();

  console.log('render scene');

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', flex: '1 1 0', minHeight: 0 }}>
      <PageToolbar title={title}>
        {actions.map((action) => (
          <action.Component key={action.state.key} model={action} />
        ))}
        {$timeRange && <$timeRange.Component model={$timeRange} />}
      </PageToolbar>
      <div style={{ flexGrow: 1, display: 'flex', padding: '16px' }}>
        <layout.Component model={layout} isEditing={isEditing} />
      </div>
    </div>
  );
});

SceneRenderer.displayName = 'SceneRenderer';
