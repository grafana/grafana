import React, { FC, useEffect, useState } from 'react';
import { SceneGrid } from './SceneGrid';
import { Scene } from '../models';
import { combineAll, map, mergeAll, mergeMap } from 'rxjs/operators';
import { combineLatest, concat, merge, zip } from 'rxjs';
import { useObservable } from '@grafana/data';
import { ZipSubscriber } from 'rxjs/internal/observable/zip';

export interface Props {
  model: Scene;
}

export const SceneView: FC<Props> = React.memo(({ model }) => {
  const panels = useObservable(zip(...model.panels), null);

  console.log('SceneView render');

  return (
    <>
      <div className="navbar">
        <div className="navbar-page-btn">{model.title}</div>
      </div>
      <div className="dashboard-content">{panels && <SceneGrid panels={panels} />}</div>
    </>
  );
});
