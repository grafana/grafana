import React, { FC, useEffect, useState } from 'react';
import { SceneGrid } from './SceneGrid';
import { Scene, SceneItem } from '../models';
import { map, mergeAll, mergeMap } from 'rxjs/operators';
import { combineLatest, concat, merge } from 'rxjs';

export interface Props {
  model: Scene;
}

export const SceneView: FC<Props> = ({ model }) => {
  const [panels, setPanels] = useState<SceneItem[]>([]);

  useEffect(() => {
    const subscription = model.panels.pipe(mergeMap(item => combineLatest(item))).subscribe({
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
