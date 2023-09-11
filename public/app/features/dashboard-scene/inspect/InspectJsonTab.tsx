import React from 'react';

import { SceneComponentProps, SceneObjectBase } from '@grafana/scenes';

import { InspectTabState } from './types';

export class InspectJsonTab extends SceneObjectBase<InspectTabState> {
  static Component = ({ model }: SceneComponentProps<InspectJsonTab>) => {
    return <div>JSON</div>;
  };
}
