// Libraries
import React, { FC, useEffect, useState } from 'react';
import { connect } from 'react-redux';

// Types
import { StoreState } from 'app/types';
import { getDemoScene } from './scenes/demo';
import { Scene } from './models';
import { SceneView } from './components/SceneView';

export interface Props {
  name: string;
}

export const DynDashPageUnconnected: FC<Props> = ({ name }) => {
  const [scene, setScene] = useState<Scene | null>(null);

  useEffect(() => {
    const subscription = getDemoScene(name).subscribe({
      next: scene => setScene(scene),
    });

    return subscription.unsubscribe;
  }, []);

  if (!scene) {
    return <h2>Loading...</h2>;
  }

  return (
    <div className="dashboard-container">
      <SceneView model={scene} />
    </div>
  );
};

export const mapStateToProps = (state: StoreState) => ({
  name: state.location.routeParams.name,
});

const mapDispatchToProps = {};

export default connect(mapStateToProps, mapDispatchToProps)(DynDashPageUnconnected);
