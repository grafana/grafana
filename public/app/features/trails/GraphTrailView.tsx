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
import { ToolbarButton } from '@grafana/ui';
import { Box, Flex } from '@grafana/ui/src/unstable';

import { ActionViewBreakdown } from './ActionViewBreakdown';
import { ActionViewLogs } from './ActionViewLogs';
import { ActionViewRelatedMetrics } from './ActionViewRelatedMetrics';
import { getTrailFor } from './getUtils';
import {
  ActionViewDefinition,
  DataTrailActionView,
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
          this.setActionView(actionViewDef?.getScene());
        }
      }
    } else if (values.actionView === null) {
      this.setActionView(undefined);
    }
  }

  private setActionView(actionView: DataTrailActionView | undefined) {
    const { body } = this.state;
    if (actionView) {
      body.setState({
        children: [...body.state.children.slice(0, 2), actionView],
      });
      this.setState({ actionView: actionView.getName() });
    } else {
      body.setState({ children: body.state.children.slice(0, 2) });
      this.setState({ actionView: undefined });
    }
  }

  public toggleActionView(actionViewDef: ActionViewDefinition) {
    if (this.state.actionView === actionViewDef.value) {
      this.setActionView(undefined);
    } else {
      this.setActionView(actionViewDef.getScene());
    }
  }

  static Component = ({ model }: SceneComponentProps<GraphTrailView>) => {
    const { body } = model.useState();

    return <body.Component model={body} />;
  };
}

const actionViewsDefinitions: ActionViewDefinition[] = [
  { displayName: 'Breakdown', value: 'breakdown', getScene: () => new ActionViewBreakdown({}) },
  { displayName: 'Logs', value: 'logs', getScene: () => new ActionViewLogs({}) },
  { displayName: 'Related metrics', value: 'related', getScene: () => new ActionViewRelatedMetrics({}) },
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
              onClick={() => graphView.toggleActionView(viewDef)}
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
  return new SceneFlexLayout({
    direction: 'column',
    children: [
      new SceneFlexItem({
        minHeight: 300,
        maxHeight: 400,
        body: PanelBuilders.timeseries()
          .setTitle(metric)
          .setOption('legend', { showLegend: false })
          .setCustomFieldConfig('fillOpacity', 9)
          .setData(
            new SceneQueryRunner({
              datasource: trailsDS,
              queries: [
                {
                  refId: 'A',
                  expr: 'sum(rate(${metric}{${filters}}[$__rate_interval]))',
                },
              ],
            })
          )
          .build(),
      }),
      new SceneFlexItem({
        ySizing: 'content',
        body: new MetricActionBar({}),
      }),
    ],
  });
}
