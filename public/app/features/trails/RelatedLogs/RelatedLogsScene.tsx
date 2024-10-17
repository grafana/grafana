import { useContext, useEffect } from 'react';

import {
  SceneComponentProps,
  sceneGraph,
  SceneObjectBase,
  SceneObjectState,
  DataSourceVariable,
  PanelBuilders,
  SceneFlexItem,
  SceneFlexLayout,
  SceneObject,
  SceneQueryRunner,
  SceneVariableSet,
  VariableValueSelectors,
} from '@grafana/scenes';
import { Stack } from '@grafana/ui';

// import { SelectMetricAction } from '../MetricSelect/SelectMetricAction';
import { VAR_LOGS_DATASOURCE, VAR_LOGS_DATASOURCE_EXPR, VAR_METRIC } from '../shared';

import { LogsIntegrationContext } from './LogsIntegrationContext';

export interface RelatedLogsSceneState extends SceneObjectState {
  initialDS?: string;
  controls: SceneObject[];
  body: SceneFlexLayout;
  lokiQuery: string;
}

export class RelatedLogsScene extends SceneObjectBase<RelatedLogsSceneState> {
  constructor(state: Partial<RelatedLogsSceneState>) {
    const logsQuery = new SceneQueryRunner({
      datasource: { uid: VAR_LOGS_DATASOURCE_EXPR },
      queries: [
        {
          refId: 'A',
          expr: `{namespace=~"amixr-(dev|staging|prod)", job=~"amixr-(dev|staging|prod)/amixr-engine"} |= "inbound" != "/health/" != "/ready" != "path=/ "`,
        },
      ],
    });

    super({
      $variables: getVariableSet(state.initialDS),
      controls: [new VariableValueSelectors({ layout: 'vertical' })],
      body:
        state.body ??
        new SceneFlexLayout({
          direction: 'column',
          children: [
            new SceneFlexItem({
              body: PanelBuilders.logs().setTitle('Logs').setData(logsQuery).build(),
            }),
          ],
        }),
      lokiQuery: state.lokiQuery ?? '{} | logfmt',
      ...state,
    });

    this.addActivationHandler(this.onActivate.bind(this));
  }

  private onActivate() {
    const {} = sceneGraph.getVariables(this);
  }

  public updateLokiQuery(expr: string) {
    console.log(`NEW LOKI QUERY`, expr);
    // const logsQuery = new SceneQueryRunner({
    //   datasource: { uid: VAR_LOGS_DATASOURCE_EXPR },
    //   queries: [
    //     {
    //       refId: 'A',
    //       expr,
    //     },
    //   ],
    // });

    // const newBody = new SceneFlexLayout({
    //   direction: 'column',
    //   children: [
    //     new SceneFlexItem({
    //       body: PanelBuilders.logs()
    //         .setTitle('Logs')
    //         .setData(logsQuery)
    //         // .setHeaderActions(new SelectMetricAction({ metric: LOGS_METRIC, title: 'Open' }))
    //         .build(),
    //     }),
    //   ],
    // });
    // this.setState({ body: newBody });
  }

  static Component = ({ model }: SceneComponentProps<RelatedLogsScene>) => {
    const { controls, body } = model.useState();
    const selectedMetricVar = sceneGraph.lookupVariable(VAR_METRIC, model);
    const selectedMetric = selectedMetricVar?.getValue()?.toString() ?? '';
    console.log(selectedMetric);
    const { findLogsDsForSelectedMetric, getLokiQueryForMetric } = useContext(LogsIntegrationContext);
    const lokiDs = findLogsDsForSelectedMetric(selectedMetric);
    // const dsNamesWithRelevantLogs = lokiDs.reduce((acc, el) => {
    //   acc.add(el.name);
    //   return acc;
    // }, new Set<string>([]));
    const lokiQuery = getLokiQueryForMetric(selectedMetric, lokiDs[0]?.uid);
    useEffect(() => {
      if (lokiQuery) {
        model.updateLokiQuery(lokiQuery);
      }
    }, [lokiQuery, model]);

    return (
      <div>
        <h1>Matching Data Sources:</h1>
        <pre>{JSON.stringify(lokiDs)}</pre>
        <h1>Loki Query for Selected DS:</h1>
        <pre>{lokiQuery}</pre>
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
      </div>
    );
  };
}

export function buildRelatedLogsScene() {
  return new RelatedLogsScene({});
}

// const VAR_LOKI_QUERY = 'lokiQuery';

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
