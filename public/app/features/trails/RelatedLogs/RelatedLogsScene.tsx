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
  VizPanel,
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

const RELATED_LOGS_PANEL_KEY = 'related_logs/logs_panel';

export class RelatedLogsScene extends SceneObjectBase<RelatedLogsSceneState> {
  constructor(state: Partial<RelatedLogsSceneState>) {
    const logsPanel = PanelBuilders.logs().setTitle('Logs').setNoValue('No logs found').build();
    logsPanel.setState({ key: RELATED_LOGS_PANEL_KEY });

    super({
      controls: [],
      body: new SceneFlexLayout({
        direction: 'column',
        height: '400px',
        children: [new SceneFlexItem({ body: logsPanel })],
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
        this.setLogsPanelData();
      }
    },
  });

  private setLogsPanelData() {
    const relatedLogsPanel = sceneGraph.findByKeyAndType(this, RELATED_LOGS_PANEL_KEY, VizPanel);

    if (!relatedLogsPanel) {
      return;
    }

    relatedLogsPanel.setState({
      $data: new SceneQueryRunner({
        datasource: { uid: VAR_LOGS_DATASOURCE_EXPR },
        queries: [
          {
            refId: 'A',
            expr: this.state.lokiQuery,
          },
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
