import React from 'react';

import { SceneComponentProps, SceneObjectStatePlain, SceneObjectBase } from '@grafana/scenes';
import { Input } from '@grafana/ui';

export interface SceneSearchBoxState extends SceneObjectStatePlain {
  value: string;
}

export class SceneSearchBox extends SceneObjectBase<SceneSearchBoxState> {
  public onChange = (evt: React.FormEvent<HTMLInputElement>) => {
    this.setState({ value: evt.currentTarget.value });
  };

  public static Component = ({ model }: SceneComponentProps<SceneSearchBox>) => {
    const { value } = model.useState();

    return <Input width={25} placeholder="Search..." value={value} onChange={model.onChange} />;
  };
}
