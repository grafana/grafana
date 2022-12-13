// Libraries
import React from 'react';

import { GrafanaRouteComponentProps } from 'app/core/navigation/types';

import { getSceneByTitle } from './scenes';

export interface Props extends GrafanaRouteComponentProps<{ name: string }> {}

export function ScenePage(props: Props) {
  const scene = getSceneByTitle(props.match.params.name, true);

  if (!scene) {
    return <h2>Scene not found</h2>;
  }

  return <scene.Component model={scene} />;
}

export default ScenePage;
