import { PageToolbar, useForceUpdate } from '@grafana/ui';
import { GRID_CELL_HEIGHT } from 'app/core/constants';
import React from 'react';
import { v4 as uuidv4 } from 'uuid';

export class Scene {
  title: string = 'Title';
  panels: ScenePanel[] = [];

  update = () => { };
}

export function SceneRenderer({ scene }: { scene: Scene }) {
  scene.update = useForceUpdate();

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', width: '100%' }}>
      <PageToolbar title={scene.title} />
      <div style={{ padding: 16, width: '100%', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {scene.panels.map(panel => <ScenePanelRenderer panel={panel} />)}
      </div>
    </div>
  )
}

export class ScenePanel {
  id = uuidv4();
  title?: string;
  width: number = 10;
  height: number = 5;
}

export function ScenePanelRenderer({ panel }: { panel: ScenePanel }) {
  // panel.update = useForceUpdate();

  return (
    <div key={panel.id} id={panel.id} style={getSceneItemStyles(panel)}>
      {panel.title && <h2>{panel.title}</h2>}
    </div>
  );
}

export interface ScenePanelSize {
  width: number;
  height: number;
}

function getSceneItemStyles(panel: ScenePanel) {
  return {
    width: `${(panel.width / 24) * 100}%`,
    height: `${panel.height * GRID_CELL_HEIGHT}px`,
    border: '1px solid #DD3344',
  }
}

export function getDemoScene(): Scene {
  const scene = new Scene();

  setTimeout(() => {
    scene.title = 'new title';
    scene.panels.push(new ScenePanel())
    scene.panels.push(new ScenePanel())
    scene.update();
  }, 1000);

  return scene;
}

// interface PanelProps {
//   panel: ScenePanel;
// }

// const ScenePanelView: FC<PanelProps> = ({ panel }) => {
//   switch (panel.type) {
//     case 'viz':
//       return <SceneVizView panel={panel} />;
//     case 'scene':
//       return <SceneView model={panel} />;
//     case 'component':
//       return <ComponentView panel={panel} />;
//   }
// };

