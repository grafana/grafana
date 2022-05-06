// Libraries
import React, { FC } from 'react';

// Types
import { getDemoScene } from './scenes/demo';
import { SceneView } from './components/SceneView';
import { useObservable } from '@grafana/data';

export interface Props {
  name: string;
}

export const DynDashPage: FC<Props> = ({ name }) => {
  const scene = useObservable(getDemoScene(name), null);

  if (!scene) {
    return <h2>Loading...</h2>;
  }
  console.log('scene', scene);

  return (
    <div style={{ height: '100%', display: 'flex', width: '100%' }}>
      <SceneView model={scene} />
    </div>
  );
};

export default DynDashPage;
