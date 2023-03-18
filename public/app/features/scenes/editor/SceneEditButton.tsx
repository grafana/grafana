import React from 'react';

import { SceneComponentProps, SceneObjectBase, SceneObjectStatePlain } from '@grafana/scenes';
import { Button } from '@grafana/ui';

import { DashboardScene } from '../dashboard/DashboardScene';

export class SceneEditButton extends SceneObjectBase<SceneObjectStatePlain> {
  public static Component = SceneEditButtonRender;

  public onToggleEditMode = () => {
    const parent = this.parent as DashboardScene;
    parent.toggleEditMode();
  };
}

function SceneEditButtonRender({ model }: SceneComponentProps<SceneEditButton>) {
  return <Button onClick={model.onToggleEditMode}>Edit</Button>;
}
