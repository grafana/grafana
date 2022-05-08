// Libraries
import React, { FC } from 'react';

// Types
// import { useObservable } from '@grafana/data';
import { getDemoScene } from './scenes/demo';

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
      <scene.Component model={scene} />
    </div>
  );
};

export default DynDashPage;
