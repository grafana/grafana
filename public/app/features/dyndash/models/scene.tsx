import React from 'react';
import { ReplaySubject } from 'rxjs';

import { useObservable } from '@grafana/data';
import { Button, PageToolbar } from '@grafana/ui';
import { GRID_CELL_HEIGHT } from 'app/core/constants';

export abstract class SceneItem<TState> {
  subject = new ReplaySubject<TState>();

  constructor(public state: TState) {
    this.subject.next(state);
  }

  update(state: Partial<TState>) {
    this.state = {
      ...this.state,
      ...state,
    };
    this.subject.next(this.state);
  }

  abstract Component(props: SceneItemComponentProps<TState>): React.ReactElement | null;

  useState() {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useObservable(this.subject, this.state);
  }
}

interface SceneItemComponentProps<T> {
  model: SceneItem<T>;
}

interface SceneState {
  title: string;
  children: Array<SceneItem<any>>;
}

export class Scene extends SceneItem<SceneState> {
  Component = SceneRenderer;
}

const SceneRenderer = React.memo<SceneItemComponentProps<SceneState>>(({ model }) => {
  const { title, children } = model.useState();
  console.log('render scene');

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', width: '100%' }}>
      <PageToolbar title={title} />
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

const ScenePanelRenderer = React.memo<SceneItemComponentProps<PanelProps>>(({ model }) => {
  const state = model.useState();
  console.log('render panel');

  return <div style={getSceneItemStyles(state)}>{state.title && <h2>{state.title}</h2>}</div>;
});

ScenePanelRenderer.displayName = 'ScenePanelRenderer';

export interface ScenePanelButtonProps extends PanelProps {
  buttonText: string;
  onClick: () => void;
}

export class ScenePanelButton extends SceneItem<ScenePanelButtonProps> {
  Component = ({ model }: SceneItemComponentProps<ScenePanelButtonProps>) => {
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
