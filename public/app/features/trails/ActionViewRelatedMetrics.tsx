import React from 'react';

import { SceneObjectState, SceneObjectBase, SceneComponentProps } from '@grafana/scenes';

import { MetricSelectLayout } from './MetricSelectLayout';
import { DataTrailActionView } from './shared';

export interface ActionViewRelatedMetricsState extends SceneObjectState {
  body: MetricSelectLayout;
}

export class ActionViewRelatedMetrics
  extends SceneObjectBase<ActionViewRelatedMetricsState>
  implements DataTrailActionView
{
  constructor(state: Partial<ActionViewRelatedMetricsState>) {
    super({
      body: state.body ?? new MetricSelectLayout({}),
    });
  }

  public getName(): string {
    return 'related';
  }

  public static Component = ({ model }: SceneComponentProps<ActionViewRelatedMetrics>) => {
    return <model.state.body.Component model={model.state.body} />;
  };
}
