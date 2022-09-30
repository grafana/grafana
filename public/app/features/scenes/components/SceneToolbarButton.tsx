import React from 'react';

import { IconName, Input, ToolbarButton } from '@grafana/ui';

import { SceneObjectBase } from '../core/SceneObjectBase';
import { SceneComponentProps, SceneObjectStatePlain } from '../core/types';

export interface ToolbarButtonState extends SceneObjectStatePlain {
  icon: IconName;
  onClick: () => void;
}

export class SceneToolbarButton extends SceneObjectBase<ToolbarButtonState> {
  static Component = ({ model }: SceneComponentProps<SceneToolbarButton>) => {
    const state = model.useState();

    return <ToolbarButton onClick={state.onClick} icon={state.icon} />;
  };
}

export interface SceneToolbarInputState extends SceneObjectStatePlain {
  value?: string;
  onChange: (value: number) => void;
}

export class SceneToolbarInput extends SceneObjectBase<SceneToolbarInputState> {
  static Component = ({ model }: SceneComponentProps<SceneToolbarInput>) => {
    const state = model.useState();

    return (
      <Input
        defaultValue={state.value}
        width={8}
        onBlur={(evt) => {
          model.state.onChange(parseInt(evt.currentTarget.value, 10));
        }}
      />
    );
  };
}
