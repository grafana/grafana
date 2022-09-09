import React from 'react';

import { SceneObjectBase } from '../core/SceneObjectBase';
import { SceneComponentProps, SceneLayoutChildState, SceneLayoutState } from '../core/types';

export enum Orientation {
  Horizontal = 'horizontal',
  Vertical = 'vertical',
}

export interface SceneToolbarState extends SceneLayoutState, SceneLayoutChildState {
  orientation: 'horizontal' | 'vertical';
}

export class SceneToolbar extends SceneObjectBase<SceneToolbarState> {
  static Component = ({ model }: SceneComponentProps<SceneToolbar>) => {
    const state = model.useState();

    return (
      <>
        {state.children.map((child) => {
          return <child.Component key={child.state.key} model={child} />;
        })}
      </>
    );
  };

  toJSON() {
    const { children, $editor, $variables, ...rest } = this.state;
    return rest;
  }
}
