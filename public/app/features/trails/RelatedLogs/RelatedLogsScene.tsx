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

import { MetricsLogsConnector } from '../Integrations/logs/base';
import { createLabelsCrossReferenceConnector } from '../Integrations/logs/labelsCrossReference';
import { lokiRecordingRulesConnector } from '../Integrations/logs/lokiRecordingRules';
import { reportExploreMetrics } from '../interactions';
import { VAR_FILTERS, VAR_LOGS_DATASOURCE, VAR_LOGS_DATASOURCE_EXPR, VAR_METRIC_EXPR } from '../shared';

import { NoRelatedLogsScene } from './NoRelatedLogsFoundScene';
import { LogQLCombiner } from './logqlCombiner';

export interface RelatedLogsSceneState extends SceneObjectState {
  controls: SceneObject[];
  body: SceneFlexLayout;
  connectors: MetricsLogsConnector[];
}

const LOGS_PANEL_CONTAINER_KEY = 'related_logs/logs_panel_container';
const RELATED_LOGS_QUERY_KEY = 'related_logs/logs_query';

export class RelatedLogsScene extends SceneObjectBase<RelatedLogsSceneState> {
  logqlQueryCombiner = new LogQLCombiner();
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
      connectors: [],
      ...state,
    });

    this.addActivationHandler(this.onActivate.bind(this));
  }

  private onActivate() {
    this.setState({
      connectors: [lokiRecordingRulesConnector, createLabelsCrossReferenceConnector(this)],
    });
    this.setLogsDataSourceVar();
  }

  private setLogsDataSourceVar() {
    const selectedMetric = sceneGraph.interpolate(this, VAR_METRIC_EXPR);
    Promise.all(this.state.connectors.map((connector) => connector.getDataSources(selectedMetric))).then((results) => {
      const lokiDataSources = results.flat().slice(0, 10); // limit to the first ten matching Loki data sources
      const logsPanelContainer = sceneGraph.findByKeyAndType(this, LOGS_PANEL_CONTAINER_KEY, SceneFlexItem);

      if (!lokiDataSources?.length) {
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
                query: lokiDataSources?.map((ds) => `${ds.name} : ${ds.uid}`).join(','),
              }),
            ],
          }),
          controls: [new VariableValueSelectors({ layout: 'vertical' })],
        });
      }
    });
  }

  private updateLokiQuery() {
    const selectedMetric = sceneGraph.interpolate(this, VAR_METRIC_EXPR);
    const selectedDatasourceUid = sceneGraph.interpolate(this, VAR_LOGS_DATASOURCE_EXPR);
    // Merge the loki query expressions from all connectors
    const lokiQueries = this.state.connectors.reduce<string[]>((acc, connector) => {
      const lokiExpr = connector.getLokiQueryExpr(selectedMetric, selectedDatasourceUid);

      if (lokiExpr) {
        acc.push(lokiExpr);
      }

      return acc;
    }, []);

    const lokiQuery = this.logqlQueryCombiner.combineQueries(lokiQueries);

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

  protected _variableDependency = new VariableDependencyConfig(this, {
    variableNames: [VAR_LOGS_DATASOURCE, VAR_FILTERS],
    onReferencedVariableValueChanged: (variable: SceneVariable) => {
      const { name } = variable.state;

      if (name === VAR_LOGS_DATASOURCE) {
        this.updateLokiQuery();
      }

      if (name === VAR_FILTERS) {
        this.setLogsDataSourceVar();
        this.updateLokiQuery();
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
