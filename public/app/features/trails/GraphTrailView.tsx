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
} from '@grafana/scenes';
import { ToolbarButton, Text } from '@grafana/ui';
import { Box, Flex } from '@grafana/ui/src/unstable';

import { buildBreakdownActionScene } from './ActionViewBreakdown';
import { buildLogsScene } from './ActionViewLogs';
import { buildRelatedMetricsScene } from './ActionViewRelatedMetrics';
import { getAutoQueriesForMetric } from './AutoQueryEngine';
import { getTrailFor } from './getUtils';
import {
  ActionViewDefinition,
  getVariablesWithMetricConstant,
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
    if (actionViewDef) {
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
  const top = queries[0];

  return new SceneFlexLayout({
    direction: 'column',
    children: [
      new SceneFlexItem({
        minHeight: 300,
        maxHeight: 400,
        body: PanelBuilders.timeseries()
          .setTitle(top.title)
          .setUnit(top.unit)
          .setOption('legend', { showLegend: false })
          .setCustomFieldConfig('fillOpacity', 9)
          .setData(
            new SceneQueryRunner({
              datasource: trailsDS,
              queries: [top.query],
            })
          )
          .build(),
      }),
      new SceneFlexItem({
        ySizing: 'content',
        body: new QueryDebugView({ query: top.query.expr }),
      }),
      new SceneFlexItem({
        ySizing: 'content',
        body: new MetricActionBar({}),
      }),
    ],
  });
}

export interface QueryDebugViewState extends SceneObjectState {
  query: string;
}

export class QueryDebugView extends SceneObjectBase<QueryDebugViewState> {
  public static Component = ({ model }: SceneComponentProps<QueryDebugView>) => {
    const trail = getTrailFor(model);
    const { debug } = trail.useState();

    if (!debug) {
      return null;
    }

    return <div className="small">sceneGraph.interpolate(model, model.state.query)</div>;
  };
}
