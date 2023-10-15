import React from 'react';

import { getFrameDisplayName } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import {
  ConstantVariable,
  EmbeddedScene,
  getUrlSyncManager,
  PanelBuilders,
  QueryVariable,
  SceneComponentProps,
  SceneDataNode,
  SceneFlexItem,
  SceneFlexLayout,
  SceneObject,
  SceneObjectBase,
  SceneObjectState,
  SceneObjectUrlSyncConfig,
  SceneObjectUrlValues,
  SceneQueryRunner,
  SceneVariableSet,
} from '@grafana/scenes';
import { VariableHide } from '@grafana/schema';
import { ToolbarButton } from '@grafana/ui';
import { Box, Flex } from '@grafana/ui/src/unstable';
import { Page } from 'app/core/components/Page/Page';

import { ByFrameRepeater } from './ByFrameRepeater';
import { buildSelectMetricScene } from './StepSelectMetric';
import { SplittableLayoutItem, VariableTabLayout } from './VariableTabLayout';
import { trailsDS } from './common';

export interface DataTrailState extends SceneObjectState {
  activeScene?: EmbeddedScene;
  metric?: string;
  /** Active action view name */
  actionView?: string;
}

export class DataTrail extends SceneObjectBase<DataTrailState> {
  protected _urlSync = new SceneObjectUrlSyncConfig(this, { keys: ['metric', 'actionView'] });

  public constructor(state: Partial<DataTrailState>) {
    super(state);

    this.addActivationHandler(this._onActivate.bind(this));
  }

  private startScene: EmbeddedScene = buildSelectMetricScene();

  public _onActivate() {
    this.syncSceneWithState();

    getUrlSyncManager().initSync(this);

    return () => {
      getUrlSyncManager().cleanUp(this);
    };
  }

  getUrlState() {
    return { metric: this.state.metric, actionView: this.state.actionView };
  }

  updateFromUrl(values: SceneObjectUrlValues) {
    const stateUpdate: Partial<DataTrailState> = {};

    if (typeof values.metric === 'string') {
      if (this.state.metric !== values.metric) {
        stateUpdate.metric = values.metric;
        stateUpdate.activeScene = buildGraphScene(this.startScene, values.metric);
      }
    } else if (values.metric === null) {
      stateUpdate.metric = undefined;
      stateUpdate.activeScene = this.startScene;
    }

    if (typeof values.actionView === 'string') {
      if (this.state.actionView !== values.actionView) {
        stateUpdate.actionView = values.actionView;
        stateUpdate.activeScene = buildBreakdownScene(stateUpdate.activeScene ?? this.state.activeScene!);
      }
    } else if (values.actionView === null) {
      stateUpdate.actionView = undefined;
      stateUpdate.activeScene = removeActionScene(this.state.activeScene!);
    }

    this.setState(stateUpdate);
  }

  private syncSceneWithState() {
    let activeScene = this.state.activeScene;

    if (!this.state.metric && activeScene !== this.startScene) {
      this.setState({ activeScene: this.startScene });
      return;
    }

    if (this.state.metric) {
      activeScene = buildGraphScene(this.startScene, this.state.metric);
    }

    if (this.state.actionView === 'breakdown') {
      activeScene = buildBreakdownScene(this.state.activeScene!);
    }

    this.setState({ activeScene });
  }

  static Component = ({ model }: SceneComponentProps<DataTrail>) => {
    const { activeScene } = model.useState();

    if (!activeScene) {
      return null;
    }

    return <activeScene.Component model={activeScene} />;
  };
}

export interface DataTrailsAppState extends SceneObjectState {
  trail?: DataTrail;
}

export class DataTrailsApp extends SceneObjectBase<DataTrailsAppState> {
  public constructor(state: Partial<DataTrailsAppState>) {
    super(state);
  }

  static Component = ({ model }: SceneComponentProps<DataTrailsApp>) => {
    const { trail } = model.useState();

    if (!trail) {
      return null;
    }

    return (
      <Page navId="explore" pageNav={{ text: 'Data trails' }}>
        {trail && <trail.Component model={trail} />}
      </Page>
    );
  };
}

export const dataTrailsApp = new DataTrailsApp({
  trail: new DataTrail({}),
});

function buildGraphScene(currentScene: EmbeddedScene, metric: string) {
  const clone = currentScene.clone();

  clone.setState({
    $variables: new SceneVariableSet({
      variables: [
        clone.state.$variables!.state.variables[0],
        new ConstantVariable({
          name: 'metric',
          value: metric,
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
            .setTitle(metric)
            .setData(
              new SceneQueryRunner({
                datasource: trailsDS,
                queries: [
                  {
                    refId: 'A',
                    expr: 'sum(rate(${metric}{${labelFilters}}[$__rate_interval]))',
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
  });

  return clone;
}

function buildBreakdownScene(activeScene: EmbeddedScene) {
  const layout = activeScene.state.body as SceneFlexLayout;

  const newChildren = [...layout.state.children, getBreakdownScene()];

  layout.setState({ children: newChildren });
  return activeScene;
}

function removeActionScene(activeScene: EmbeddedScene) {
  const layout = activeScene.state.body as SceneFlexLayout;

  const newChildren = layout.state.children.slice(0, 2);

  layout.setState({ children: newChildren });
  return activeScene;
}

function getBreakdownScene() {
  return new SceneFlexItem({
    body: new VariableTabLayout({
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
            expr: 'sum(rate(${metric}{${labelFilters}}[$__rate_interval])) by($groupby)',
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
    }),
  });
}

export interface MetricActionBarState extends SceneObjectState {}

export class MetricActionBar extends SceneObjectBase<MetricActionBarState> {
  public onToggleBreakdown = () => {
    const { actionView } = getTrailFor(this).state;
    locationService.partial({ actionView: actionView === 'breakdown' ? null : 'breakdown' }, true);
  };

  public static Component = ({ model }: SceneComponentProps<MetricActionBar>) => {
    const { actionView } = getTrailFor(model).useState();

    return (
      <Box paddingY={1}>
        <Flex gap={2}>
          <ToolbarButton variant={actionView === 'breakdown' ? 'active' : 'canvas'} onClick={model.onToggleBreakdown}>
            Breakdown
          </ToolbarButton>
          <ToolbarButton variant={'canvas'} onClick={model.onToggleBreakdown}>
            View logs
          </ToolbarButton>
          <ToolbarButton variant={'canvas'} onClick={model.onToggleBreakdown}>
            Related metrics
          </ToolbarButton>
          <ToolbarButton variant={'canvas'} onClick={model.onToggleBreakdown}>
            Add to dashboard
          </ToolbarButton>
          <ToolbarButton variant={'canvas'} onClick={model.onToggleBreakdown}>
            Bookmark trail
          </ToolbarButton>
        </Flex>
      </Box>
    );
  };
}

function getTrailFor(model: SceneObject): DataTrail {
  if (model instanceof DataTrail) {
    return model;
  }

  if (model.parent) {
    return getTrailFor(model.parent);
  }

  console.error('Unable to find trail for', model);

  throw new Error('Unable to find trail');
}
