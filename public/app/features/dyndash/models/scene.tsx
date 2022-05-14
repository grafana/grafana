import React, { CSSProperties } from 'react';

import { PageToolbar } from '@grafana/ui';

import { SceneComponentProps, SceneItemBase, SceneLayoutItemChildState } from './SceneItem';
import { SceneQueryRunner } from './SceneQueryRunner';
import { SceneTimeRange } from './SceneTimeRange';

interface SceneState {
  title: string;
  layout: SceneItemBase<any>;
  timeRange: SceneTimeRange;
  queryRunner?: SceneQueryRunner;
}

export class Scene extends SceneItemBase<SceneState> {
  Component = SceneRenderer;
}

const SceneRenderer = React.memo<SceneComponentProps<Scene>>(({ model }) => {
  const { title, layout, timeRange } = model.useState();

  console.log('render scene');

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', flex: '1 1 0', minHeight: 0 }}>
      <PageToolbar title={title}>
        <timeRange.Component model={timeRange} />
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

// export interface ScenePanelButtonProps extends PanelState {
//   buttonText: string;
//   onClick: () => void;
// }

// export class ScenePanelButton extends SceneItem<ScenePanelButtonProps> {
//   Component = ({ model }: SceneComponentProps<ScenePanelButton>) => {
//     const props = model.useState();

//     return (
//       <div style={getSceneItemStyles(props)}>
//         <Button onClick={props.onClick}>{props.buttonText}</Button>
//       </div>
//     );
//   };
// }

// export interface ScenePanelSize {
//   width: number;
//   height: number;
// }

function getItemStyles() {
  const style: CSSProperties = {
    display: 'flex',
    border: '1px solid red',
    height: '100%',
    width: '100%',
  };

  return style;
}
