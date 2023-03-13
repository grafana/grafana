// Libraries
import React, { useEffect, useState } from 'react';

import { GrafanaRouteComponentProps } from 'app/core/navigation/types';

import { getSceneByTitle } from './scenes';

export interface Props extends GrafanaRouteComponentProps<{ name: string }> {}

export const ScenePage = (props: Props) => {
  const scene = getSceneByTitle(props.match.params.name);
  const [isInitialized, setInitialized] = useState(false);

  useEffect(() => {
    if (scene && !isInitialized) {
      scene.initUrlSync();
      setInitialized(true);
    }
  }, [isInitialized, scene]);

  if (!scene) {
    return <h2>Scene not found</h2>;
  }

  if (!isInitialized) {
    return null;
  }

  return <scene.Component model={scene} />;
};

export default ScenePage;
