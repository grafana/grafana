import { useObservable } from '@grafana/data';
import { PageToolbar } from '@grafana/ui';
import { GRID_CELL_HEIGHT } from 'app/core/constants';
import React from 'react';
import { ReplaySubject } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';

export abstract class SceneElement<T> {
  subject = new ReplaySubject<T>();

  constructor(public props: T) {
    this.subject.next(props);
  }

  update(props: Partial<T>) {
    this.props = {
      ...this.props,
      ...props
    };
    this.subject.next(this.props);
  }
}

interface SceneProps {
  title: string;
  panels: ScenePanel[]
};

export class Scene extends SceneElement<SceneProps> {

}


export function SceneRenderer({ scene }: { scene: Scene }) {
  const { title, panels } = useObservable(scene.subject, scene.props)
  console.log('render scene');

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', width: '100%' }}>
      <PageToolbar title={title} />
      <div style={{ padding: 16, width: '100%', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {panels.map(panel => <ScenePanelRenderer key={panel.props.id} panel={panel} />)}
      </div>
    </div>
  )
}

export interface PanelProps {
  id: string;
  title?: string;
  width: number;
  height: number;
}

export class ScenePanel extends SceneElement<PanelProps> { }

export const ScenePanelRenderer = React.memo<{ panel: ScenePanel }>(({ panel }) => {
  const { title } = useObservable(panel.subject, panel.props);
  console.log('render panel');

  return (
    <div style={getSceneItemStyles(panel.props)}>
      {title && <h2>{title}</h2>}
    </div>
  );
});

export interface ScenePanelSize {
  width: number;
  height: number;
}

function getSceneItemStyles(props: PanelProps) {
  return {
    width: `${(props.width / 24) * 100}%`,
    height: `${props.height * GRID_CELL_HEIGHT}px`,
    border: '1px solid #DD3344',
  }
}


