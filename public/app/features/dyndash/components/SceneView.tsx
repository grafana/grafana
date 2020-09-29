import React, { FC, useEffect, useState } from 'react';
import { SceneGrid } from './SceneGrid';
import { Scene, ScenePanel } from '../models';

export interface Props {
  model: Scene;
}

export const SceneView: FC<Props> = ({ model }) => {
  const [panels, setPanels] = useState<ScenePanel[]>([]);

  useEffect(() => {
    const subscription = model.panels.subscribe({
      next: panels => setPanels(panels),
    });

    return subscription.unsubscribe;
  }, []);

  return (
    <>
      <div className="navbar">
        <div className="navbar-page-btn">{model.title}</div>
      </div>
      <div className="dashboard-content">
        <SceneGrid panels={panels} />
      </div>
    </>
  );
};
