import React, { FC } from 'react';
import { SceneGrid } from './SceneGrid';
import { Scene } from '../models';
import { zip } from 'rxjs';
import { useObservable } from '@grafana/data';
import { PageToolbar } from '@grafana/ui';

export interface Props {
  model: Scene;
}

export const SceneView: FC<Props> = React.memo(({ model }) => {
  const panels = useObservable(zip(...model.panels), null);

  console.log('SceneView render', panels);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', width: '100%' }}>
      <PageToolbar title="Dynamic dashboard" />
      <div style={{ flexGrow: 1, padding: 16, width: '100%' }}>{panels && <SceneGrid panels={panels} />}</div>
    </div>
  );
});
