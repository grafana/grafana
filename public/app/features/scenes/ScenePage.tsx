// Libraries
import React, { FC } from 'react';

import { GrafanaRouteComponentProps } from 'app/core/navigation/types';

import { getScenes } from './scenes';

export interface Props extends GrafanaRouteComponentProps<{ name: string }> {}

export const ScenePage: FC<Props> = (props) => {
  const scene = getScenes().find((x) => x.state.title === props.match.params.name);

  if (!scene) {
    return <h2>Scene not found</h2>;
  }

  return (
    <div style={{ height: '100%', display: 'flex', width: '100%' }}>
      <scene.Component model={scene} />
    </div>
  );
};

export default ScenePage;
