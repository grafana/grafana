// Libraries
import React, { FC } from 'react';
import { connect } from 'react-redux';

// Types
import { StoreState } from 'app/types';
import { getDemoScene } from './scenes/demo';
import { SceneView } from './components/SceneView';
import { useObservable } from '@grafana/data';

export interface Props {
  name: string;
}

export const DynDashPageUnconnected: FC<Props> = ({ name }) => {
  const scene = useObservable(getDemoScene(name), null);

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
