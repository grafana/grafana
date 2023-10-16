import React from 'react';

import { SceneComponentProps, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { Page } from 'app/core/components/Page/Page';

import { DataTrail } from './DataTrail';

export interface DataTrailsAppState extends SceneObjectState {
  trail?: DataTrail;
}

export class DataTrailsApp extends SceneObjectBase<DataTrailsAppState> {
  public constructor(state: Partial<DataTrailsAppState>) {
    super(state);
  }

  static Component = ({ model }: SceneComponentProps<DataTrailsApp>) => {
    const { trail } = model.useState();

    if (!trail) {
      return null;
    }

    return (
      <Page navId="explore" pageNav={{ text: 'Data trail' }}>
        {trail && <trail.Component model={trail} />}
      </Page>
    );
  };
}

export const dataTrailsApp = new DataTrailsApp({
  trail: new DataTrail({ embedded: false }),
});
