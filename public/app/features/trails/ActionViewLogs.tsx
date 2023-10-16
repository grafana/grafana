import React from 'react';

import {
  SceneObjectState,
  SceneObjectBase,
  SceneComponentProps,
  PanelBuilders,
  SceneFlexItem,
  SceneFlexLayout,
  SceneQueryRunner,
} from '@grafana/scenes';

import { DataTrailActionView } from './shared';

export interface ActionViewLogsState extends SceneObjectState {
  body: SceneFlexLayout;
}

export class ActionViewLogs extends SceneObjectBase<ActionViewLogsState> implements DataTrailActionView {
  constructor(state: Partial<ActionViewLogsState>) {
    super({ body: state.body ?? buildLogsScene() });
  }

  public getName(): string {
    return 'logs';
  }

  public static Component = ({ model }: SceneComponentProps<ActionViewLogs>) => {
    return <model.state.body.Component model={model.state.body} />;
  };
}

function buildLogsScene() {
  return new SceneFlexLayout({
    $data: new SceneQueryRunner({
      queries: [
        {
          refId: 'A',
          datasource: { uid: 'gdev-loki' },
          expr: '{${filters}} | logfmt',
        },
      ],
    }),
    children: [
      new SceneFlexItem({
        minHeight: 300,
        body: PanelBuilders.logs().setTitle('Logs').build(),
      }),
    ],
  });
}
