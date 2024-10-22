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
import { VAR_LOGS_DATASOURCE, VAR_LOGS_DATASOURCE_EXPR, VAR_METRIC_EXPR } from '../shared';

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
    fetchAndExtractLokiRecordingRules().then((lokiRecordingRules) => {
      const selectedMetric = sceneGraph.interpolate(this, VAR_METRIC_EXPR);
      const lokiDs = getLogsUidOfMetric(selectedMetric, lokiRecordingRules);
      this.setState({
        $variables: new SceneVariableSet({
          variables: [
            new CustomVariable({
              name: VAR_LOGS_DATASOURCE,
              label: 'Logs data source',
              query: lokiDs?.map((ds) => `${ds.name} : ${ds.uid}`).join(','),
            }),
          ],
        }),
        controls: [new VariableValueSelectors({ layout: 'vertical' })],
        lokiRecordingRules,
      });
    });
  }

  protected _variableDependency = new VariableDependencyConfig(this, {
    variableNames: [VAR_LOGS_DATASOURCE],
    onReferencedVariableValueChanged: (variable: SceneVariable) => {
      const { name } = variable.state;

      if (name === VAR_LOGS_DATASOURCE) {
        const selectedMetric = sceneGraph.interpolate(this, VAR_METRIC_EXPR);
        const selectedDatasource = sceneGraph.interpolate(this, VAR_LOGS_DATASOURCE_EXPR);
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
