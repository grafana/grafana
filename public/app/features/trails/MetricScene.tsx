import { css } from '@emotion/css';
import React, { useState } from 'react';

import { DashboardCursorSync, GrafanaTheme2 } from '@grafana/data';
import {
  SceneObjectState,
  SceneObjectBase,
  SceneComponentProps,
  SceneFlexLayout,
  SceneFlexItem,
  SceneObjectUrlSyncConfig,
  SceneObjectUrlValues,
  sceneGraph,
  SceneVariableSet,
  QueryVariable,
  behaviors,
} from '@grafana/scenes';
import { ToolbarButton, Box, Stack, Icon, TabsBar, Tab, useStyles2 } from '@grafana/ui';

import { buildBreakdownActionScene } from './ActionTabs/BreakdownScene';
import { buildMetricOverviewScene } from './ActionTabs/MetricOverviewScene';
import { buildRelatedMetricsScene } from './ActionTabs/RelatedMetricsScene';
import { getAutoQueriesForMetric } from './AutomaticMetricQueries/AutoQueryEngine';
import { AutoVizPanel } from './AutomaticMetricQueries/AutoVizPanel';
import { getTrailStore } from './TrailStore/TrailStore';
import {
  ActionViewDefinition,
  ActionViewType,
  getVariablesWithMetricConstant,
  MakeOptional,
  OpenEmbeddedTrailEvent,
  trailDS,
  VAR_GROUP_BY,
  VAR_METRIC_EXPR,
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
      $variables: state.$variables ?? getVariableSet(state.metric),
      body: state.body ?? buildGraphScene(state.metric),
      ...state,
    });

    this.addActivationHandler(this._onActivate.bind(this));
  }

  private _onActivate() {
    if (this.state.actionView === undefined) {
      this.setActionView('overview');
    }
  }

  getUrlState() {
    return { actionView: this.state.actionView };
  }

  updateFromUrl(values: SceneObjectUrlValues) {
    if (typeof values.actionView === 'string') {
      if (this.state.actionView !== values.actionView) {
        const actionViewDef = actionViewsDefinitions.find((v) => v.value === values.actionView);
        if (actionViewDef) {
          this.setActionView(actionViewDef.value);
        }
      }
    } else if (values.actionView === null) {
      this.setActionView(undefined);
    }
  }

  public setActionView(actionView?: ActionViewType) {
    const { body } = this.state;
    const actionViewDef = actionViewsDefinitions.find((v) => v.value === actionView);

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
  { displayName: 'Overview', value: 'overview', getScene: buildMetricOverviewScene },
  { displayName: 'Breakdown', value: 'breakdown', getScene: buildBreakdownActionScene },
  { displayName: 'Related metrics', value: 'related', getScene: buildRelatedMetricsScene },
];

export interface MetricActionBarState extends SceneObjectState {}

export class MetricActionBar extends SceneObjectBase<MetricActionBarState> {
  public onOpenTrail = () => {
    this.publishEvent(new OpenEmbeddedTrailEvent(), true);
  };

  public static Component = ({ model }: SceneComponentProps<MetricActionBar>) => {
    const metricScene = sceneGraph.getAncestor(model, MetricScene);
    const styles = useStyles2(getStyles);
    const trail = getTrailFor(model);
    const [isBookmarked, setBookmarked] = useState(false);
    const { actionView } = metricScene.useState();

    const onBookmarkTrail = () => {
      getTrailStore().addBookmark(trail);
      setBookmarked(!isBookmarked);
    };

    return (
      <Box paddingY={1}>
        <div className={styles.actions}>
          <Stack gap={2}>
            <ToolbarButton variant={'canvas'} icon="compass" tooltip="Open in explore (todo)" disabled>
              Explore
            </ToolbarButton>
            <ToolbarButton variant={'canvas'}>Add to dashboard</ToolbarButton>
            <ToolbarButton variant={'canvas'} icon="share-alt" tooltip="Copy url (todo)" disabled />
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
            {trail.state.embedded && (
              <ToolbarButton variant={'canvas'} onClick={model.onOpenTrail}>
                Open
              </ToolbarButton>
            )}
          </Stack>
        </div>

        <TabsBar>
          {actionViewsDefinitions.map((tab, index) => {
            return (
              <Tab
                key={index}
                label={tab.displayName}
                active={actionView === tab.value}
                onChangeTab={() => metricScene.setActionView(tab.value)}
              />
            );
          })}
        </TabsBar>
      </Box>
    );
  };
}

function getStyles(theme: GrafanaTheme2) {
  return {
    actions: css({
      [theme.breakpoints.up(theme.breakpoints.values.md)]: {
        position: 'absolute',
        right: 0,
        zIndex: 2,
      },
    }),
  };
}

function getVariableSet(metric: string) {
  return new SceneVariableSet({
    variables: [
      ...getVariablesWithMetricConstant(metric),
      new QueryVariable({
        name: VAR_GROUP_BY,
        label: 'Group by',
        datasource: trailDS,
        includeAll: true,
        defaultToAll: true,
        query: { query: `label_names(${VAR_METRIC_EXPR})`, refId: 'A' },
        value: '',
        text: '',
      }),
    ],
  });
}

const MAIN_PANEL_MIN_HEIGHT = 280;
const MAIN_PANEL_MAX_HEIGHT = '40%';

function buildGraphScene(metric: string) {
  const autoQuery = getAutoQueriesForMetric(metric);
  const bodyAutoVizPanel = new AutoVizPanel({ autoQuery });

  return new SceneFlexLayout({
    direction: 'column',
    $behaviors: [new behaviors.CursorSync({ key: 'metricCrosshairSync', sync: DashboardCursorSync.Crosshair })],
    children: [
      new SceneFlexItem({
        minHeight: MAIN_PANEL_MIN_HEIGHT,
        maxHeight: MAIN_PANEL_MAX_HEIGHT,
        body: bodyAutoVizPanel,
      }),
      new SceneFlexItem({
        ySizing: 'content',
        body: new MetricActionBar({}),
      }),
    ],
  });
}
