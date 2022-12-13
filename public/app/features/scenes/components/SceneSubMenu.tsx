import React from 'react';

import { SceneObjectBase } from '../core/SceneObjectBase';
import { SceneLayoutState, SceneComponentProps } from '../core/types';

interface SceneSubMenuState extends SceneLayoutState {}

export class SceneSubMenu extends SceneObjectBase<SceneSubMenuState> {
  public static Component = SceneSubMenuRenderer;
}

function SceneSubMenuRenderer({ model }: SceneComponentProps<SceneSubMenu>) {
  const { children } = model.useState();

  return (
    <div style={{ display: 'flex', gap: '16px' }}>
      {children.map((child) => (
        <child.Component key={child.state.key} model={child} />
      ))}
    </div>
  );
}

export class SceneSubMenuSpacer extends SceneObjectBase<{}> {
  public constructor() {
    super({});
  }

  public static Component = (_props: SceneComponentProps<SceneSubMenuSpacer>) => {
    return <div style={{ flexGrow: 1 }} />;
  };
}
