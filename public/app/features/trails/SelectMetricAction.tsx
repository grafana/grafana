import React from 'react';

import { SceneObjectState, SceneObjectBase, SceneComponentProps } from '@grafana/scenes';
import { Button } from '@grafana/ui';

import { MetricSelectedEvent } from './shared';

export interface SelectMetricActionState extends SceneObjectState {
  title: string;
  metric: string;
}

export class SelectMetricAction extends SceneObjectBase<SelectMetricActionState> {
  public onClick = () => {
    this.publishEvent(new MetricSelectedEvent(this.state.metric), true);
  };

  public static Component = ({ model }: SceneComponentProps<SelectMetricAction>) => {
    return (
      <Button variant="primary" size="sm" fill="text" onClick={model.onClick}>
        {model.state.title}
      </Button>
    );
  };
}
