import React from 'react';

import {
  SceneObjectState,
  SceneObjectBase,
  SceneComponentProps,
  SceneFlexLayout,
  SceneFlexItem,
  SceneQueryRunner,
  SceneObjectUrlSyncConfig,
  SceneObjectUrlValues,
  sceneGraph,
  PanelBuilders,
} from '@grafana/scenes';
import { ToolbarButton } from '@grafana/ui';
import { Box, Flex } from '@grafana/ui/src/unstable';
import { PromQuery } from 'app/plugins/datasource/prometheus/types';

import { getAutoQueriesForMetric } from './AutomaticMetricQueries/AutoQueryEngine';
import { AutoVizPanel } from './AutomaticMetricQueries/AutoVizPanel';
import { buildBreakdownActionScene } from './BreakdownScene';
import { MetricSelectScene } from './MetricSelectScene';
import { SelectMetricAction } from './SelectMetricAction';
import {
  ActionViewDefinition,
  getVariablesWithMetricConstant,
  KEY_SQR_METRIC_VIZ_QUERY,
  LOGS_METRIC,
  MakeOptional,
  OpenEmbeddedTrailEvent,
} from './shared';
import { showOnlyInAdvanced } from './showOnlyInAdvanced';
import { getParentOfType, getTrailFor } from './utils';

export interface MetricSceneState extends SceneObjectState {
  body: SceneFlexLayout;
  metric: string;
  actionView?: string;
}

export class MetricScene extends SceneObjectBase<MetricSceneState> {
  protected _urlSync = new SceneObjectUrlSyncConfig(this, { keys: ['actionView'] });

  public constructor(state: MakeOptional<MetricSceneState, 'body'>) {
    super({
      $variables: state.$variables ?? getVariablesWithMetricConstant(state.metric),
      body: state.body ?? buildGraphScene(state.metric),
      ...state,
    });
  }

  getUrlState() {
    return { actionView: this.state.actionView };
  }

  updateFromUrl(values: SceneObjectUrlValues) {
    if (typeof values.actionView === 'string') {
      if (this.state.actionView !== values.actionView) {
        const actionViewDef = actionViewsDefinitions.find((v) => v.value === values.actionView);
        if (actionViewDef) {
          this.setActionView(actionViewDef);
        }
      }
    } else if (values.actionView === null) {
      this.setActionView(undefined);
    }
  }

  public setActionView(actionViewDef?: ActionViewDefinition) {
    const { body } = this.state;

    if (actionViewDef && actionViewDef.value !== this.state.actionView) {
      // reduce max height for main panel to reduce height flicker
      body.state.children[0].setState({ maxHeight: MAIN_PANEL_MIN_HEIGHT });
      body.setState({ children: [...body.state.children.slice(0, 3), actionViewDef.getScene()] });
      this.setState({ actionView: actionViewDef.value });
    } else {
      // restore max height
      body.state.children[0].setState({ maxHeight: MAIN_PANEL_MAX_HEIGHT });
      body.setState({ children: body.state.children.slice(0, 3) });
      this.setState({ actionView: undefined });
    }
  }

  static Component = ({ model }: SceneComponentProps<MetricScene>) => {
    const { body } = model.useState();
    return <body.Component model={body} />;
  };
}

const actionViewsDefinitions: ActionViewDefinition[] = [
  { displayName: 'Breakdown', value: 'breakdown', getScene: buildBreakdownActionScene },
  { displayName: 'Logs', value: 'logs', getScene: buildLogsScene },
  { displayName: 'Related metrics', value: 'related', getScene: buildRelatedMetricsScene },
];

export interface MetricActionBarState extends SceneObjectState {}

export class MetricActionBar extends SceneObjectBase<MetricActionBarState> {
  public getButtonVariant(actionViewName: string, currentView: string | undefined) {
    return currentView === actionViewName ? 'active' : 'canvas';
  }

  public onOpenTrail = () => {
    this.publishEvent(new OpenEmbeddedTrailEvent(), true);
  };

  public static Component = ({ model }: SceneComponentProps<MetricActionBar>) => {
    const metricScene = getParentOfType(model, MetricScene);
    const trail = getTrailFor(model);
    const { actionView } = metricScene.useState();

    return (
      <Box paddingY={1}>
        <Flex gap={2}>
          {actionViewsDefinitions.map((viewDef) => (
            <ToolbarButton
              key={viewDef.value}
              variant={viewDef.value === actionView ? 'active' : 'canvas'}
              onClick={() => metricScene.setActionView(viewDef)}
            >
              {viewDef.displayName}
            </ToolbarButton>
          ))}
          <ToolbarButton variant={'canvas'}>Add to dashboard</ToolbarButton>
          <ToolbarButton variant={'canvas'} icon="bookmark" />
          <ToolbarButton variant={'canvas'} icon="share-alt" />
          {trail.state.embedded && (
            <ToolbarButton variant={'canvas'} onClick={model.onOpenTrail}>
              Open
            </ToolbarButton>
          )}
        </Flex>
      </Box>
    );
  };
}

const MAIN_PANEL_MIN_HEIGHT = 250;
const MAIN_PANEL_MAX_HEIGHT = '50%';

function buildGraphScene(metric: string) {
  const queries = getAutoQueriesForMetric(metric);

  return new SceneFlexLayout({
    direction: 'column',
    children: [
      new SceneFlexItem({
        minHeight: MAIN_PANEL_MIN_HEIGHT,
        maxHeight: MAIN_PANEL_MAX_HEIGHT,
        body: new AutoVizPanel({ queries }),
      }),
      new SceneFlexItem({
        ySizing: 'content',
        isHidden: true,
        $behaviors: [showOnlyInAdvanced],
        body: new QueryDebugView({}),
      }),
      new SceneFlexItem({
        ySizing: 'content',
        body: new MetricActionBar({}),
      }),
    ],
  });
}

export interface QueryDebugViewState extends SceneObjectState {}

export class QueryDebugView extends SceneObjectBase<QueryDebugViewState> {
  public static Component = ({ model }: SceneComponentProps<QueryDebugView>) => {
    const queryRunner = sceneGraph.findObject(model, (x) => x.state.key === KEY_SQR_METRIC_VIZ_QUERY);
    if (!(queryRunner instanceof SceneQueryRunner)) {
      return;
    }

    const query = queryRunner?.state.queries[0] as PromQuery;
    return <div className="small">{sceneGraph.interpolate(model, query.expr)}</div>;
  };
}

function buildLogsScene() {
  return new SceneFlexItem({
    $data: new SceneQueryRunner({
      queries: [
        {
          refId: 'A',
          datasource: { uid: 'gdev-loki' },
          expr: '{${filters}} | logfmt',
        },
      ],
    }),
    body: PanelBuilders.logs()
      .setTitle('Logs')
      .setHeaderActions(new SelectMetricAction({ metric: LOGS_METRIC, title: 'Open' }))
      .build(),
  });
}

function buildRelatedMetricsScene() {
  return new SceneFlexItem({
    body: new MetricSelectScene({}),
  });
}
