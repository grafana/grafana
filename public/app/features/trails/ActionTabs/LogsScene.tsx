import React from 'react';

import {
  DataSourceVariable,
  PanelBuilders,
  SceneComponentProps,
  SceneFlexItem,
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
}

export class LogsScene extends SceneObjectBase<LogsSceneState> {
  public constructor(state: Partial<LogsSceneState>) {
    super({
      $variables: state.$variables ?? getVariableSet(state.initialDS),
      controls: state.controls ?? [new VariableValueSelectors({ layout: 'vertical' })],
      $data: new SceneQueryRunner({
        queries: [
          {
            refId: 'A',
            datasource: { uid: VAR_LOGS_DATASOURCE_EXPR },
            expr: '{${filters}} | logfmt',
          },
        ],
      }),
      ...state,
    });
  }

  static Component = ({ model }: SceneComponentProps<LogsScene>) => {
    const { controls } = model.useState();
    const panel = PanelBuilders.logs()
      .setTitle('Logs')
      .setHeaderActions(new SelectMetricAction({ metric: LOGS_METRIC, title: 'Open' }))
      .build();

    return (
      <Stack gap={1} direction={'column'}>
        {controls && (
          <Stack gap={1}>
            {controls.map((control) => (
              <control.Component key={control.state.key} model={control} />
            ))}
          </Stack>
        )}
        <panel.Component model={panel} />
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
