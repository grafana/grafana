import React from 'react';

import { SelectableValue } from '@grafana/data';
import { RadioButtonGroup } from '@grafana/ui';

import { SceneObjectBase } from '../core/SceneObjectBase';
import { SceneComponentProps, SceneObjectStatePlain } from '../core/types';

export interface SceneRadioToggleState extends SceneObjectStatePlain {
  options: Array<SelectableValue<string>>;
  value: string;
}

export class SceneRadioToggle extends SceneObjectBase<SceneRadioToggleState> {
  public onChange = (value: string) => {
    this.setState({ value });
  };

  public static Component = ({ model }: SceneComponentProps<SceneRadioToggle>) => {
    const { options, value } = model.useState();

    return <RadioButtonGroup options={options} value={value} onChange={model.onChange} />;
  };
}
