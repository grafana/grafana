import React, { useState } from 'react';

import { DashboardCursorSync } from '@grafana/data';
import {
  SceneObjectState,
  SceneObjectBase,
  SceneComponentProps,
  SceneFlexLayout,
  SceneFlexItem,
  SceneQueryRunner,
  SceneObjectUrlSyncConfig,
  SceneObjectUrlValues,
  PanelBuilders,
  sceneGraph,
  behaviors,
} from '@grafana/scenes';
import { ToolbarButton, Box, Stack, Icon } from '@grafana/ui';

import { getAutoQueriesForMetric } from './AutomaticMetricQueries/AutoQueryEngine';
import { AutoVizPanel } from './AutomaticMetricQueries/AutoVizPanel';
import { buildBreakdownActionScene } from './BreakdownScene';
import { MetricSelectScene } from './MetricSelectScene';
import { SelectMetricAction } from './SelectMetricAction';
import { getTrailStore } from './TrailStore/TrailStore';
import {
  ActionViewDefinition,
  getVariablesWithMetricConstant,
  LOGS_METRIC,
  MakeOptional,
  OpenEmbeddedTrailEvent,
} from './shared';
import { getTrailFor } from './utils';

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
      body.setState({ children: [...body.state.children.slice(0, 2), actionViewDef.getScene()] });
      this.setState({ actionView: actionViewDef.value });
    } else {
      // restore max height
      body.state.children[0].setState({ maxHeight: MAIN_PANEL_MAX_HEIGHT });
      body.setState({ children: body.state.children.slice(0, 2) });
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
    const metricScene = sceneGraph.getAncestor(model, MetricScene);
    const trail = getTrailFor(model);
    const [isBookmarked, setBookmarked] = useState(false);
    const { actionView } = metricScene.useState();

    const onBookmarkTrail = () => {
      getTrailStore().addBookmark(trail);
      setBookmarked(!isBookmarked);
    };

    return (
      <Box paddingY={1}>
        <Stack gap={2}>
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
          <ToolbarButton variant={'canvas'} icon="compass" tooltip="Open in explore (todo)" disabled />
          <ToolbarButton
            variant={'canvas'}
            icon={
              isBookmarked ? (
                <Icon name={'favorite'} type={'mono'} size={'lg'} />
              ) : (
                <Icon name={'star'} type={'default'} size={'lg'} />
              )
            }
            tooltip={'Bookmark'}
            onClick={onBookmarkTrail}
          />
          <ToolbarButton variant={'canvas'} icon="share-alt" tooltip="Copy url (todo)" disabled />
          {trail.state.embedded && (
            <ToolbarButton variant={'canvas'} onClick={model.onOpenTrail}>
              Open
            </ToolbarButton>
          )}
        </Stack>
      </Box>
    );
  };
}

const MAIN_PANEL_MIN_HEIGHT = 280;
const MAIN_PANEL_MAX_HEIGHT = '40%';

function buildGraphScene(metric: string) {
  const autoQuery = getAutoQueriesForMetric(metric);

  return new SceneFlexLayout({
    direction: 'column',
    $behaviors: [new behaviors.CursorSync({ key: 'metricCrosshairSync', sync: DashboardCursorSync.Crosshair })],
    children: [
      new SceneFlexItem({
        minHeight: MAIN_PANEL_MIN_HEIGHT,
        maxHeight: MAIN_PANEL_MAX_HEIGHT,
        body: new AutoVizPanel({ autoQuery }),
      }),
      new SceneFlexItem({
        ySizing: 'content',
        body: new MetricActionBar({}),
      }),
    ],
  });
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
