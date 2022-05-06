// Libraries
import React, { FC } from 'react';

// Types
// import { useObservable } from '@grafana/data';
import { getDemoScene, SceneRenderer } from './models/scene';

export interface Props {
  name: string;
}

export const DynDashPage: FC<Props> = ({ name }) => {
  const scene = getDemoScene();

  if (!scene) {
    return <h2>Loading...</h2>;
  }

  return (
    <div style={{ height: '100%', display: 'flex', width: '100%' }}>
      {<SceneRenderer scene={scene} />}
    </div>
  );
};

export default DynDashPage;
