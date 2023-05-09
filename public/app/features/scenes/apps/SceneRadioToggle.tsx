import React from 'react';

import { SelectableValue } from '@grafana/data';
import { SceneComponentProps, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { RadioButtonGroup } from '@grafana/ui';

export interface SceneRadioToggleState extends SceneObjectState {
  options: Array<SelectableValue<string>>;
  value: string;
  onChange: (value: string) => void;
}

export class SceneRadioToggle extends SceneObjectBase<SceneRadioToggleState> {
  public onChange = (value: string) => {
    this.setState({ value });
    this.state.onChange(value);
  };

  public static Component = ({ model }: SceneComponentProps<SceneRadioToggle>) => {
    const { options, value } = model.useState();

    return <RadioButtonGroup options={options} value={value} onChange={model.onChange} />;
  };
}
