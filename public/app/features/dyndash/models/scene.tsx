import React from 'react';

import { Button, PageToolbar } from '@grafana/ui';
import { GRID_CELL_HEIGHT } from 'app/core/constants';

import { SceneComponentProps, SceneItem } from './SceneItem';
import { SceneQueryRunner } from './SceneQueryRunner';
import { SceneTimeRange } from './SceneTimeRange';

interface SceneState {
  title: string;
  children: Array<SceneItem<any>>;
  timeRange: SceneTimeRange;
  queryRunner?: SceneQueryRunner;
}

export class Scene extends SceneItem<SceneState> {
  Component = SceneRenderer;
}

const SceneRenderer = React.memo<SceneComponentProps<Scene>>(({ model }) => {
  const { title, children, timeRange } = model.useState();

  console.log('render scene');

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', width: '100%' }}>
      <PageToolbar title={title}>
        <timeRange.Component model={timeRange} />
      </PageToolbar>
      <div style={{ padding: 16, width: '100%', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {children.map((child) => (
          <child.Component key={child.state.id} model={child} />
        ))}
      </div>
    </div>
  );
});

SceneRenderer.displayName = 'SceneRenderer';

export interface PanelProps {
  id: string;
  title?: string;
  width: number;
  height: number;
}

export class ScenePanel extends SceneItem<PanelProps> {
  Component = ScenePanelRenderer;
}

const ScenePanelRenderer = React.memo<SceneComponentProps<ScenePanel>>(({ model }) => {
  const state = model.useState();

  return <div style={getSceneItemStyles(state)}>{state.title && <h2>{state.title}</h2>}</div>;
});

ScenePanelRenderer.displayName = 'ScenePanelRenderer';

export interface ScenePanelButtonProps extends PanelProps {
  buttonText: string;
  onClick: () => void;
}

export class ScenePanelButton extends SceneItem<ScenePanelButtonProps> {
  Component = ({ model }: SceneComponentProps<ScenePanelButton>) => {
    const props = model.useState();

    return (
      <div style={getSceneItemStyles(props)}>
        <Button onClick={props.onClick}>{props.buttonText}</Button>
      </div>
    );
  };
}

export interface ScenePanelSize {
  width: number;
  height: number;
}

function getSceneItemStyles(props: PanelProps) {
  return {
    width: `${(props.width / 24) * 100}%`,
    height: `${props.height * GRID_CELL_HEIGHT}px`,
    border: '1px solid #DD3344',
  };
}
