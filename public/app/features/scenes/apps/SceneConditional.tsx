import React from 'react';

import { SceneObjectBase } from '../core/SceneObjectBase';
import { SceneComponentProps, SceneObject, SceneObjectStatePlain } from '../core/types';

// This component did not work due to layout rendering a child for the conditional object even though it was not active.

export interface SceneConditionalState<T extends SceneObject> extends SceneObjectStatePlain {
  source: T;
  eval: (source: T) => boolean;
  scene: SceneObject;
  isActive?: boolean;
}

export class SceneConditional<T extends SceneObject> extends SceneObjectBase<SceneConditionalState<T>> {
  public activate(): void {
    super.activate();

    this._subs.add(
      this.state.source.subscribeToState({
        next: (state) => {
          const isActive = this.state.eval(this.state.source);
          if (isActive !== this.state.isActive) {
            this.setState({ isActive });
          }
        },
      })
    );
  }

  public static Component = ({ model }: SceneComponentProps<SceneConditional<any>>) => {
    const { isActive, scene } = model.useState();
    if (!isActive) {
      return null;
    }

    return <scene.Component model={scene} />;
  };
}
