import React from 'react';

import {
  DataSourceVariable,
  PanelBuilders,
  SceneComponentProps,
  SceneFlexItem,
  SceneFlexLayout,
  SceneObject,
  SceneObjectBase,
  SceneObjectState,
  SceneQueryRunner,
  SceneVariableSet,
  VariableValueSelectors,
} from '@grafana/scenes';
import { Stack } from '@grafana/ui';

import { SelectMetricAction } from '../SelectMetricAction';
import { LOGS_METRIC, VAR_LOGS_DATASOURCE, VAR_LOGS_DATASOURCE_EXPR } from '../shared';

interface LogsSceneState extends SceneObjectState {
  initialDS?: string;
  controls: SceneObject[];
  body: SceneFlexLayout;
}

export class LogsScene extends SceneObjectBase<LogsSceneState> {
  public constructor(state: Partial<LogsSceneState>) {
    const logsQuery = new SceneQueryRunner({
      datasource: { uid: VAR_LOGS_DATASOURCE_EXPR },
      queries: [
        {
          refId: 'A',
          expr: '{${filters}} | logfmt',
        },
      ],
    });

    super({
      $variables: state.$variables ?? getVariableSet(state.initialDS),
      controls: state.controls ?? [new VariableValueSelectors({ layout: 'vertical' })],
      body:
        state.body ??
        new SceneFlexLayout({
          direction: 'column',
          children: [
            new SceneFlexItem({
              body: PanelBuilders.logs()
                .setTitle('Logs')
                .setData(logsQuery)
                .setHeaderActions(new SelectMetricAction({ metric: LOGS_METRIC, title: 'Open' }))
                .build(),
            }),
          ],
        }),
      ...state,
    });
  }

  static Component = ({ model }: SceneComponentProps<LogsScene>) => {
    const { controls, body } = model.useState();

    return (
      <Stack gap={1} direction={'column'} grow={1}>
        {controls && (
          <Stack gap={1}>
            {controls.map((control) => (
              <control.Component key={control.state.key} model={control} />
            ))}
          </Stack>
        )}
        <body.Component model={body} />
      </Stack>
    );
  };
}

function getVariableSet(initialDS?: string) {
  return new SceneVariableSet({
    variables: [
      new DataSourceVariable({
        name: VAR_LOGS_DATASOURCE,
        label: 'Logs data source',
        value: initialDS,
        pluginId: 'loki',
      }),
    ],
  });
}

export function buildLogsScene() {
  return new SceneFlexItem({
    body: new LogsScene({}),
  });
}
