import React from 'react';

import { getFrameDisplayName } from '@grafana/data';
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
  QueryVariable,
  SceneDataNode,
} from '@grafana/scenes';
import { VariableHide } from '@grafana/schema';
import { ToolbarButton } from '@grafana/ui';
import { Box, Flex } from '@grafana/ui/src/unstable';

import { ByFrameRepeater } from './ByFrameRepeater';
import { SplittableLayoutItem, VariableTabLayout } from './VariableTabLayout';
import { trailsDS } from './common';

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
        this.setActionView(buildBreakdownScene());
      }
    } else if (values.actionView === null) {
      this.setActionView(undefined);
    }
  }

  private setActionView(actionView: SceneObject | undefined) {
    const { body } = this.state;
    if (actionView) {
      body.setState({
        children: [...body.state.children.slice(0, 2), actionView],
      });
      this.setState({ actionView: 'breakdown' });
    } else {
      body.setState({ children: body.state.children.slice(0, 2) });
      this.setState({ actionView: undefined });
    }
  }

  public onToggleBreakdown = () => {
    if (this.state.actionView === 'breakdown') {
      this.setActionView(undefined);
    } else {
      this.setActionView(buildBreakdownScene());
    }
  };

  static Component = ({ model }: SceneComponentProps<GraphTrailView>) => {
    const { body } = model.useState();

    return <body.Component model={body} />;
  };
}

export interface MetricActionBarState extends SceneObjectState {}

export class MetricActionBar extends SceneObjectBase<MetricActionBarState> {
  public static Component = ({ model }: SceneComponentProps<MetricActionBar>) => {
    const trail = getGraphView(model);
    const { actionView } = trail.useState();

    return (
      <Box paddingY={1}>
        <Flex gap={2}>
          <ToolbarButton variant={actionView === 'breakdown' ? 'active' : 'canvas'} onClick={trail.onToggleBreakdown}>
            Breakdown
          </ToolbarButton>
          <ToolbarButton variant={'canvas'}>View logs</ToolbarButton>
          <ToolbarButton variant={'canvas'}>Related metrics</ToolbarButton>
          <ToolbarButton variant={'canvas'}>Add to dashboard</ToolbarButton>
          <ToolbarButton variant={'canvas'}>Bookmark trail</ToolbarButton>
        </Flex>
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

function buildBreakdownScene() {
  return new VariableTabLayout({
    $variables: new SceneVariableSet({
      variables: [
        new QueryVariable({
          name: 'groupby',
          label: 'Group by',
          datasource: { uid: 'gdev-prometheus' },
          query: 'label_names(${metric})',
          value: '',
          text: '',
        }),
      ],
    }),
    variableName: 'groupby',
    $data: new SceneQueryRunner({
      queries: [
        {
          refId: 'A',
          datasource: { uid: 'gdev-prometheus' },
          expr: 'sum(rate(${metric}{${filters}}[$__rate_interval])) by($groupby)',
        },
      ],
    }),
    body: new SplittableLayoutItem({
      isSplit: false,
      single: new SceneFlexLayout({
        direction: 'column',
        children: [
          new SceneFlexItem({
            minHeight: 300,
            body: PanelBuilders.timeseries().setHoverHeader(true).build(),
          }),
        ],
      }),
      split: new ByFrameRepeater({
        body: new SceneFlexLayout({
          direction: 'column',
          children: [],
        }),
        getLayoutChild: (data, frame, frameIndex) => {
          return new SceneFlexItem({
            minHeight: 200,
            body: PanelBuilders.timeseries()
              .setTitle(getFrameDisplayName(frame, frameIndex))
              .setData(new SceneDataNode({ data: { ...data, series: [frame] } }))
              .setOption('legend', { showLegend: false })
              .setCustomFieldConfig('fillOpacity', 9)
              .build(),
          });
        },
      }),
    }),
  });
}
