import React from 'react';

import {
  SceneObjectState,
  SceneObjectBase,
  SceneComponentProps,
  SceneVariableSet,
  ConstantVariable,
  SceneObject,
  SceneFlexLayout,
  SceneFlexItem,
  PanelBuilders,
  SceneQueryRunner,
  SceneObjectUrlSyncConfig,
  SceneObjectUrlValues,
} from '@grafana/scenes';
import { VariableHide } from '@grafana/schema';
import { ToolbarButton, Stack, Box } from '@grafana/ui';

import { ActionViewBreakdown } from './ActionViewBreakdown';
import { ActionViewLogs } from './ActionViewLogs';
import { ActionViewDefinition, DataTrailActionView, trailsDS } from './shared';

export interface GraphTrailViewState extends SceneObjectState {
  body: SceneFlexLayout;
  metric: string;
  actionView?: string;
}

export class GraphTrailView extends SceneObjectBase<GraphTrailViewState> {
  protected _urlSync = new SceneObjectUrlSyncConfig(this, { keys: ['actionView'] });

  public constructor(state: Omit<GraphTrailViewState, 'body'>) {
    super({
      $variables: new SceneVariableSet({
        variables: [
          new ConstantVariable({
            name: 'metric',
            value: state.metric,
            hide: VariableHide.hideVariable,
          }),
        ],
      }),
      body: new SceneFlexLayout({
        direction: 'column',
        children: [
          new SceneFlexItem({
            minHeight: 400,
            maxHeight: 400,
            body: PanelBuilders.timeseries()
              .setTitle(state.metric)
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
      }),
      ...state,
    });
  }

  getUrlState() {
    return { actionView: this.state.actionView };
  }

  updateFromUrl(values: SceneObjectUrlValues) {
    if (typeof values.actionView === 'string') {
      if (this.state.actionView !== values.actionView) {
        this.setActionView(new ActionViewBreakdown({}));
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

const actionViews: ActionViewDefinition[] = [
  { name: 'Breakdown', value: 'breakdown', getScene: () => new ActionViewBreakdown({}) },
  { name: 'Logs', value: 'logs', getScene: () => new ActionViewLogs({}) },
];

export interface MetricActionBarState extends SceneObjectState {}

export class MetricActionBar extends SceneObjectBase<MetricActionBarState> {
  public getButtonVariant(actionViewName: string, currentView: string | undefined) {
    return currentView === actionViewName ? 'active' : 'canvas';
  }

  public static Component = ({ model }: SceneComponentProps<MetricActionBar>) => {
    const trail = getGraphView(model);
    const { actionView } = trail.useState();

    return (
      <Box paddingY={1}>
        <Stack gap={2}>
          {actionViews.map((viewDef) => (
            <ToolbarButton
              key={viewDef.value}
              variant={viewDef.value === actionView ? 'active' : 'canvas'}
              onClick={() => trail.toggleActionView(viewDef)}
            >
              {viewDef.name}
            </ToolbarButton>
          ))}
          <ToolbarButton variant={model.getButtonVariant('logs', actionView)}>View logs</ToolbarButton>
          <ToolbarButton variant={'canvas'}>Related metrics</ToolbarButton>
          <ToolbarButton variant={'canvas'}>Add to dashboard</ToolbarButton>
          <ToolbarButton variant={'canvas'}>Bookmark trail</ToolbarButton>
        </Stack>
      </Box>
    );
  };
}

function getGraphView(model: SceneObject): GraphTrailView {
  if (model instanceof GraphTrailView) {
    return model;
  }

  if (model.parent) {
    return getGraphView(model.parent);
  }

  console.error('Unable to find graph view for', model);

  throw new Error('Unable to find trail');
}
