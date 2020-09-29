// Libraries
import React, { FC, useEffect, useState } from 'react';
import { connect } from 'react-redux';

// Types
import { StoreState } from 'app/types';
import { getScene } from './examples/examples';
import { Scene } from './state/models';
import { SceneView } from './SceneView';

export interface Props {
  name: string;
}

export const DynDashPageUnconnected: FC<Props> = ({ name }) => {
  const [scene, setScene] = useState<Scene | null>(null);

  useEffect(() => {
    const subscription = getScene(name).subscribe({
      next: scene => setScene(scene),
    });

    return subscription.unsubscribe;
  }, []);

  if (!scene) {
    return <h2>Loading...</h2>;
  }

  return <SceneView model={scene} />;
};

export const mapStateToProps = (state: StoreState) => ({
  name: state.location.routeParams.name,
});

const mapDispatchToProps = {};

export default connect(mapStateToProps, mapDispatchToProps)(DynDashPageUnconnected);
