import React from 'react';

import { SceneComponentProps, SceneObject, SceneObjectBase, SceneObjectStatePlain } from '@grafana/scenes';

import { SceneComponentEditWrapper } from './SceneComponentEditWrapper';

interface SceneBodyEditWrapperState extends SceneObjectStatePlain {
  body: SceneObject;
}

export class SceneBodyEditWrapper extends SceneObjectBase<SceneBodyEditWrapperState> {
  public componentWrapper = SceneComponentEditWrapper;

  public static Component = ({ model }: SceneComponentProps<SceneBodyEditWrapper>) => {
    return <model.state.body.Component model={model.state.body} />;
  };
}
