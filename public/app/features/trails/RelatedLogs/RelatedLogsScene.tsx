import { config } from '@grafana/runtime';
import {
  CustomVariable,
  PanelBuilders,
  SceneFlexItem,
  SceneFlexLayout,
  sceneGraph,
  SceneObject,
  SceneObjectBase,
  SceneQueryRunner,
  SceneVariableSet,
  VariableDependencyConfig,
  VariableValueSelectors,
  type SceneComponentProps,
  type SceneObjectState,
  type SceneVariable,
} from '@grafana/scenes';
import { Stack, LinkButton } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';

import {
  fetchAndExtractLokiRecordingRules,
  getLokiQueryForRelatedMetric,
  getDataSourcesWithRecordingRulesContainingMetric,
  type ExtractedRecordingRules,
} from '../Integrations/logsIntegration';
import { reportExploreMetrics } from '../interactions';
import { VAR_LOGS_DATASOURCE, VAR_LOGS_DATASOURCE_EXPR, VAR_METRIC_EXPR } from '../shared';

import { NoRelatedLogsScene } from './NoRelatedLogsFoundScene';

export interface RelatedLogsSceneState extends SceneObjectState {
  controls: SceneObject[];
  body: SceneFlexLayout;
  lokiRecordingRules: ExtractedRecordingRules;
}

const LOGS_PANEL_CONTAINER_KEY = 'related_logs/logs_panel_container';
const RELATED_LOGS_QUERY_KEY = 'related_logs/logs_query';

export class RelatedLogsScene extends SceneObjectBase<RelatedLogsSceneState> {
  constructor(state: Partial<RelatedLogsSceneState>) {
    super({
      controls: [],
      body: new SceneFlexLayout({
        direction: 'column',
        height: '400px',
        children: [
          new SceneFlexItem({
            key: LOGS_PANEL_CONTAINER_KEY,
            body: undefined,
          }),
        ],
      }),
      lokiRecordingRules: {},
      ...state,
    });

    this.addActivationHandler(this.onActivate.bind(this));
  }

  private onActivate() {
    fetchAndExtractLokiRecordingRules().then((lokiRecordingRules) => {
      const selectedMetric = sceneGraph.interpolate(this, VAR_METRIC_EXPR);
      const lokiDatasources = getDataSourcesWithRecordingRulesContainingMetric(selectedMetric, lokiRecordingRules);
      const logsPanelContainer = sceneGraph.findByKeyAndType(this, LOGS_PANEL_CONTAINER_KEY, SceneFlexItem);

      if (!lokiDatasources?.length) {
        logsPanelContainer.setState({
          body: new NoRelatedLogsScene({}),
        });
      } else {
        logsPanelContainer.setState({
          body: PanelBuilders.logs()
            .setTitle('Logs')
            .setData(
              new SceneQueryRunner({
                datasource: { uid: VAR_LOGS_DATASOURCE_EXPR },
                queries: [],
                key: RELATED_LOGS_QUERY_KEY,
              })
            )
            .build(),
        });
        this.setState({
          $variables: new SceneVariableSet({
            variables: [
              new CustomVariable({
                name: VAR_LOGS_DATASOURCE,
                label: 'Logs data source',
                query: lokiDatasources?.map((ds) => `${ds.name} : ${ds.uid}`).join(','),
              }),
            ],
          }),
          controls: [new VariableValueSelectors({ layout: 'vertical' })],
          lokiRecordingRules,
        });
      }
    });
  }

  protected _variableDependency = new VariableDependencyConfig(this, {
    variableNames: [VAR_LOGS_DATASOURCE],
    onReferencedVariableValueChanged: (variable: SceneVariable) => {
      const { name } = variable.state;

      if (name === VAR_LOGS_DATASOURCE) {
        const selectedMetric = sceneGraph.interpolate(this, VAR_METRIC_EXPR);
        const selectedDatasourceUid = sceneGraph.interpolate(this, VAR_LOGS_DATASOURCE_EXPR);
        const lokiQuery = getLokiQueryForRelatedMetric(
          selectedMetric,
          selectedDatasourceUid,
          this.state.lokiRecordingRules
        );

        if (lokiQuery) {
          const relatedLogsQuery = sceneGraph.findByKeyAndType(this, RELATED_LOGS_QUERY_KEY, SceneQueryRunner);
          relatedLogsQuery.setState({
            queries: [
              {
                refId: 'A',
                expr: lokiQuery,
                maxLines: 100,
              },
            ],
          });
        }
      }
    },
  });

  static readonly Component = ({ model }: SceneComponentProps<RelatedLogsScene>) => {
    const { controls, body } = model.useState();

    return (
      <div>
        <Stack gap={1} direction={'column'} grow={1}>
          <Stack gap={1} direction={'row'} grow={1} justifyContent={'space-between'} alignItems={'start'}>
            {controls && (
              <Stack gap={1}>
                {controls.map((control) => (
                  <control.Component key={control.state.key} model={control} />
                ))}
              </Stack>
            )}
            <LinkButton
              href={`${config.appSubUrl}/a/grafana-lokiexplore-app`} // We prefix with the appSubUrl for environments that don't host grafana at the root.
              target="_blank"
              tooltip="Navigate to the Explore Logs app"
              variant="secondary"
              size="sm"
              onClick={() => reportExploreMetrics('related_logs_action_clicked', { action: 'open_explore_logs' })}
            >
              <Trans i18nKey="explore-metrics.related-logs.openExploreLogs">Open Explore Logs</Trans>
            </LinkButton>
          </Stack>
          <body.Component model={body} />
        </Stack>
      </div>
    );
  };
}

export function buildRelatedLogsScene() {
  return new RelatedLogsScene({});
}
