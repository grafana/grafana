import React from 'react';

import { IconName, Input, ToolbarButton } from '@grafana/ui';

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

export interface SceneToolbarInputState extends SceneItemState {
  value?: string;
  onChange: (value: number) => void;
}

export class SceneToolbarInput extends SceneItemBase<SceneToolbarInputState> {
  Component = ({ model }: SceneComponentProps<SceneToolbarInput>) => {
    const state = model.useState();

    return (
      <Input
        defaultValue={state.value}
        onBlur={(evt) => {
          model.state.onChange(parseInt(evt.currentTarget.value, 10));
        }}
      />
    );
  };
}
