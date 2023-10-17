import React from 'react';

import {
  SceneObjectState,
  SceneObjectBase,
  SceneComponentProps,
  SceneObject,
  SceneFlexLayout,
  SceneFlexItem,
  PanelBuilders,
  SceneQueryRunner,
  SceneObjectUrlSyncConfig,
  SceneObjectUrlValues,
  sceneGraph,
} from '@grafana/scenes';
import { ToolbarButton } from '@grafana/ui';
import { Box, Flex } from '@grafana/ui/src/unstable';
import { PromQuery } from 'app/plugins/datasource/prometheus/types';

import { AutoQueryDef, getAutoQueriesForMetric } from './AutoQueryEngine';
import { AutoVizPanel } from './AutoVizPanel';
import { buildBreakdownActionScene } from './actionViews/breakdown';
import { buildLogsScene } from './actionViews/logs';
import { buildRelatedMetricsScene } from './actionViews/relatedMetrics';
import { getTrailFor } from './getUtils';
import {
  ActionViewDefinition,
  getVariablesWithMetricConstant,
  KEY_SQR_METRIC_VIZ_QUERY,
  MakeOptional,
  OpenEmbeddedTrailEvent,
  trailsDS,
} from './shared';

export interface GraphTrailViewState extends SceneObjectState {
  body: SceneFlexLayout;
  metric: string;
  actionView?: string;
}

export class GraphTrailView extends SceneObjectBase<GraphTrailViewState> {
  protected _urlSync = new SceneObjectUrlSyncConfig(this, { keys: ['actionView'] });

  public constructor(state: MakeOptional<GraphTrailViewState, 'body'>) {
    super({
      $variables: getVariablesWithMetricConstant(state.metric),
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
      body.setState({
        children: [...body.state.children.slice(0, 3), actionViewDef.getScene()],
      });
      this.setState({ actionView: actionViewDef.value });
    } else {
      body.setState({ children: body.state.children.slice(0, 3) });
      this.setState({ actionView: undefined });
    }
  }

  static Component = ({ model }: SceneComponentProps<GraphTrailView>) => {
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
    const graphView = getGraphViewFor(model);
    const trail = getTrailFor(model);
    const { actionView } = graphView.useState();

    return (
      <Box paddingY={1}>
        <Flex gap={2}>
          {actionViewsDefinitions.map((viewDef) => (
            <ToolbarButton
              key={viewDef.value}
              variant={viewDef.value === actionView ? 'active' : 'canvas'}
              onClick={() => graphView.setActionView(viewDef)}
            >
              {viewDef.displayName}
            </ToolbarButton>
          ))}
          <ToolbarButton variant={'canvas'}>Add to dashboard</ToolbarButton>
          <ToolbarButton variant={'canvas'}>Bookmark trail</ToolbarButton>
          {trail.state.embedded && (
            <ToolbarButton variant={'canvas'} onClick={model.onOpenTrail}>
              Open trail
            </ToolbarButton>
          )}
        </Flex>
      </Box>
    );
  };
}

function getGraphViewFor(model: SceneObject): GraphTrailView {
  if (model instanceof GraphTrailView) {
    return model;
  }

  if (model.parent) {
    return getGraphViewFor(model.parent);
  }

  console.error('Unable to find graph view for', model);

  throw new Error('Unable to find trail');
}

function buildGraphScene(metric: string) {
  const queries = getAutoQueriesForMetric(metric);

  return new SceneFlexLayout({
    direction: 'column',
    children: [
      new SceneFlexItem({
        minHeight: 250,
        maxHeight: 400,
        body: new AutoVizPanel({ queries }),
      }),
      new SceneFlexItem({
        ySizing: 'content',
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
    const trail = getTrailFor(model);
    const { debug } = trail.useState();

    if (!debug) {
      return null;
    }

    const queryRunner = sceneGraph.findObject(model, (x) => x.state.key === KEY_SQR_METRIC_VIZ_QUERY);
    if (!(queryRunner instanceof SceneQueryRunner)) {
      return;
    }

    const query = queryRunner?.state.queries[0] as PromQuery;
    return <div className="small">{sceneGraph.interpolate(model, query.expr)}</div>;
  };
}
