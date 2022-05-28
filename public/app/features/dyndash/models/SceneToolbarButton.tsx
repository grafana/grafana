import React from 'react';

import { IconName, ToolbarButton } from '@grafana/ui';

import { SceneItemBase } from './SceneItem';
import { SceneComponentProps, SceneItemState } from './types';

export interface ToolbarButtonState extends SceneItemState {
  icon: IconName;
  onClick: () => void;
}

export class SceneToolbarButton extends SceneItemBase<ToolbarButtonState> {
  Component = ({ model }: SceneComponentProps<SceneToolbarButton>) => {
    const state = model.useState();

    return <ToolbarButton onClick={state.onClick} icon={state.icon} />;
  };
}

export interface ScenePanelSize {
  width: number;
  height: number;
}
