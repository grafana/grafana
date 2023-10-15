import React from 'react';

import {
  SceneObjectState,
  SceneObjectBase,
  SceneComponentProps,
  SceneVariableSet,
  ConstantVariable,
  SceneObject,
  SceneFlexLayout,
  SceneFlexItem,
  PanelBuilders,
  SceneQueryRunner,
} from '@grafana/scenes';
import { VariableHide } from '@grafana/schema';

import { MetricActionBar } from './DataTrailsScene';
import { trailsDS } from './common';

export interface GraphTrailViewState extends SceneObjectState {
  metric: string;
  body: SceneObject;
}

export class GraphTrailView extends SceneObjectBase<GraphTrailViewState> {
  public constructor(state: Omit<GraphTrailViewState, 'body'>) {
    super({
      $variables: new SceneVariableSet({
        variables: [
          new ConstantVariable({
            name: 'metric',
            value: state.metric,
            hide: VariableHide.hideVariable,
          }),
        ],
      }),
      body: new SceneFlexLayout({
        direction: 'column',
        children: [
          new SceneFlexItem({
            minHeight: 400,
            maxHeight: 400,
            body: PanelBuilders.timeseries()
              .setTitle(state.metric)
              .setData(
                new SceneQueryRunner({
                  datasource: trailsDS,
                  queries: [
                    {
                      refId: 'A',
                      expr: 'sum(rate(${metric}{${filters}}[$__rate_interval]))',
                    },
                  ],
                })
              )
              .build(),
          }),
          new SceneFlexItem({
            ySizing: 'content',
            body: new MetricActionBar({}),
          }),
        ],
      }),
      ...state,
    });
  }

  static Component = ({ model }: SceneComponentProps<GraphTrailView>) => {
    const { body } = model.useState();

    return <body.Component model={body} />;
  };
}
