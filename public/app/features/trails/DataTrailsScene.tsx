import React from 'react';

import { getFrameDisplayName } from '@grafana/data';
import {
  EmbeddedScene,
  PanelBuilders,
  QueryVariable,
  SceneComponentProps,
  SceneDataNode,
  SceneFlexItem,
  SceneFlexLayout,
  SceneObject,
  SceneObjectBase,
  SceneObjectState,
  SceneQueryRunner,
  SceneVariableSet,
} from '@grafana/scenes';
import { ToolbarButton } from '@grafana/ui';
import { Box, Flex } from '@grafana/ui/src/unstable';
import { Page } from 'app/core/components/Page/Page';

import { ByFrameRepeater } from './ByFrameRepeater';
import { DataTrail } from './DataTrail';
import { SplittableLayoutItem, VariableTabLayout } from './VariableTabLayout';

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
      <Page navId="explore" pageNav={{ text: 'Data trails', icon: 'code-branch' }}>
        {trail && <trail.Component model={trail} />}
      </Page>
    );
  };
}

export const dataTrailsApp = new DataTrailsApp({
  trail: new DataTrail({ urlSync: true }),
});

export function buildBreakdownScene(activeScene: EmbeddedScene) {
  const layout = activeScene.state.body as SceneFlexLayout;

  const newChildren = [...layout.state.children, getBreakdownScene()];

  layout.setState({ children: newChildren });
  return activeScene;
}

export function removeActionScene(activeScene: EmbeddedScene) {
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
            expr: 'sum(rate(${metric}{${Filters}}[$__rate_interval])) by($groupby)',
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
  public static Component = ({ model }: SceneComponentProps<MetricActionBar>) => {
    const trail = getTrailFor(model);
    const { actionView } = getTrailFor(model).useState();

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
