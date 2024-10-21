import {
  SceneComponentProps,
  sceneGraph,
  SceneObjectBase,
  SceneObjectState,
  PanelBuilders,
  SceneFlexItem,
  SceneFlexLayout,
  SceneObject,
  SceneQueryRunner,
  SceneVariableSet,
  VariableValueSelectors,
  CustomVariable,
  VariableDependencyConfig,
  SceneVariable,
} from '@grafana/scenes';
import { Stack } from '@grafana/ui';

import {
  ExtractedRecordingRules,
  fetchAndExtractLokiRecordingRules,
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
      controls: [],
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
    fetchAndExtractLokiRecordingRules()
      .then((rules) => this.setState({ lokiRecordingRules: rules }))
      .then(() => {
        const selectedMetricVar = sceneGraph.lookupVariable(VAR_METRIC, this);
        const selectedMetric = selectedMetricVar?.getValue()?.toString() ?? '';
        const lokiDs = getLogsUidOfMetric(selectedMetric, this.state.lokiRecordingRules);
        this.setState({
          $variables: new SceneVariableSet({
            variables: [
              new CustomVariable({
                name: VAR_LOGS_DATASOURCE,
                label: 'Logs data source',
                query: lokiDs?.map((ds) => `${ds.name} : ${ds.uid}`).join(', '),
              }),
            ],
          }),
          controls: [new VariableValueSelectors({ layout: 'vertical' })],
        });
      });
  }

  protected _variableDependency = new VariableDependencyConfig(this, {
    variableNames: [VAR_LOGS_DATASOURCE],
    onReferencedVariableValueChanged: (variable: SceneVariable) => {
      const { name } = variable.state;

      if (name === VAR_LOGS_DATASOURCE) {
        const selectedMetricVar = sceneGraph.lookupVariable(VAR_METRIC, this);
        const selectedMetric = selectedMetricVar?.getValue()?.toString() ?? '';
        const selectedDatasourceVar = sceneGraph.lookupVariable(VAR_LOGS_DATASOURCE, this);
        const selectedDatasource = selectedDatasourceVar?.getValue()?.toString() ?? '';
        const lokiQuery = getLogsQueryForMetric(selectedMetric, selectedDatasource, this.state.lokiRecordingRules);
        this.setState({ lokiQuery });
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

  static readonly Component = ({ model }: SceneComponentProps<RelatedLogsScene>) => {
    const { controls, body } = model.useState();

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
