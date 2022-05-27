import React, { CSSProperties } from 'react';

import { PageToolbar } from '@grafana/ui';

import {
  SceneComponentProps,
  SceneItemBase,
  SceneItem,
  SceneLayoutItemChildState,
  SceneItemStateWithScope,
  SceneLayoutState,
} from './SceneItem';

interface SceneState extends SceneItemStateWithScope, SceneLayoutItemChildState {
  title: string;
  layout: SceneItem<any>;
  actions?: Array<SceneItem<any>>;
}

export class Scene extends SceneItemBase<SceneState> {
  Component = SceneRenderer;
}

const SceneRenderer = React.memo<SceneComponentProps<Scene>>(({ model }) => {
  const { title, layout, $timeRange, actions = [] } = model.useState();

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
        <layout.Component model={layout} />
      </div>
    </div>
  );
});

SceneRenderer.displayName = 'SceneRenderer';

export interface PanelState extends SceneLayoutItemChildState {
  title?: string;
}

export class ScenePanel extends SceneItemBase<PanelState> {
  Component = ScenePanelRenderer;
}

const ScenePanelRenderer = React.memo<SceneComponentProps<ScenePanel>>(({ model }) => {
  const state = model.useState();

  return <div style={getItemStyles()}>{state.title && <h2>{state.title}</h2>}</div>;
});

ScenePanelRenderer.displayName = 'ScenePanelRenderer';

function getItemStyles() {
  const style: CSSProperties = {
    display: 'flex',
    border: '1px solid red',
    height: '100%',
    width: '100%',
  };

  return style;
}
