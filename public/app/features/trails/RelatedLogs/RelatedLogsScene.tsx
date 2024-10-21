/* eslint @grafana/no-untranslated-strings: "error" */
import { useEffect } from 'react';

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
  // CustomVariable,
  VariableDependencyConfig,
  SceneVariable,
} from '@grafana/scenes';
import { Stack } from '@grafana/ui';

// import { SelectMetricAction } from '../MetricSelect/SelectMetricAction';
// import type { FoundLokiDataSource } from '../Integrations/logsIntegration';
import {
  ExtractedRecordingRules,
  fetchAndExtractLokiRecordingRules,
  FoundLokiDataSource,
  getLogsUidOfMetric,
  getLogsQueryForMetric,
} from '../Integrations/logsIntegration';
import { VAR_LOGS_DATASOURCE, VAR_LOGS_DATASOURCE_EXPR, VAR_METRIC } from '../shared';

export interface RelatedLogsSceneState extends SceneObjectState {
  initialDS?: string;
  controls: SceneObject[];
  body: SceneFlexLayout;
  lokiQuery: string;
  lokiRecordingRules: ExtractedRecordingRules;
}

export class RelatedLogsScene extends SceneObjectBase<RelatedLogsSceneState> {
  constructor(state: Partial<RelatedLogsSceneState>) {
    super({
      $variables: getVariableSet(state.initialDS),
      // TODO: Replace DataSourceVariable with CustomVariable
      // that only includes data sources that have relevant logs
      //
      // $variables: new SceneVariableSet({
      //   variables: [
      //     new CustomVariable({
      //       name: VAR_LOGS_DATASOURCE,
      //       label: 'Logs data source',
      //       value: '',
      //       query: state.lokiDataSources?.map((ds) => `${ds.name} : ${ds.uid}`).join(','),
      //     }),
      //   ],
      // }),
      controls: [new VariableValueSelectors({ layout: 'vertical' })],
      body: new SceneFlexLayout({
        direction: 'column',
        height: '400px',
        children: [],
      }),
      lokiRecordingRules: {},
      lokiQuery: '',
      ...state,
    });

    this.addActivationHandler(this.onActivate.bind(this));
  }

  private onActivate() {
    // const {} = sceneGraph.getVariables(this);
    fetchAndExtractLokiRecordingRules().then((rules) => this.setState({ lokiRecordingRules: rules }));
  }

  protected _variableDependency = new VariableDependencyConfig(this, {
    variableNames: [VAR_LOGS_DATASOURCE],
    onReferencedVariableValueChanged: (variable: SceneVariable) => {
      const { name } = variable.state;

      if (name === VAR_LOGS_DATASOURCE) {
        this.buildLogsPanel();
      }
    },
  });

  private buildLogsPanel() {
    this.setState({
      body: new SceneFlexLayout({
        direction: 'column',
        height: '400px',
        children: [
          new SceneFlexItem({
            body: PanelBuilders.logs()
              .setTitle('Logs')
              .setNoValue('No logs found')
              .setData(
                new SceneQueryRunner({
                  datasource: { uid: VAR_LOGS_DATASOURCE_EXPR },
                  queries: [
                    {
                      refId: 'A',
                      expr: this.state.lokiQuery,
                    },
                  ],
                })
              )
              .build(),
          }),
        ],
      }),
    });
  }

  private readonly findLogsDsForSelectedMetric = (metricName: string): FoundLokiDataSource[] => {
    if (metricName === '') {
      return [];
    }

    return getLogsUidOfMetric(metricName, this.state.lokiRecordingRules);
  };

  private readonly getLokiQueryForMetric = (metricName: string, dataSourceId: string): string => {
    return getLogsQueryForMetric(metricName, dataSourceId, this.state.lokiRecordingRules);
  };

  private readonly updateLokiQuery = (expr: string) => {
    console.log(`NEW LOKI QUERY`, expr);
    this.setState({ lokiQuery: expr });
    this.buildLogsPanel();
  };

  static readonly Component = ({ model }: SceneComponentProps<RelatedLogsScene>) => {
    const { controls, body } = model.useState();
    const selectedMetricVar = sceneGraph.lookupVariable(VAR_METRIC, model);
    const selectedMetric = selectedMetricVar?.getValue()?.toString() ?? '';
    console.log(selectedMetric);
    const lokiDs = model.findLogsDsForSelectedMetric(selectedMetric);
    // const dsNamesWithRelevantLogs = lokiDs.reduce((acc, el) => {
    //   acc.add(el.name);
    //   return acc;
    // }, new Set<string>([]));
    const lokiQuery = model.getLokiQueryForMetric(selectedMetric, lokiDs[0]?.uid);

    useEffect(() => {
      if (lokiQuery) {
        model.updateLokiQuery(lokiQuery);
      }
    }, [lokiQuery, model]);

    return (
      <div>
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
