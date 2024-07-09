import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { config } from '@grafana/runtime';
import {
  SceneObjectState,
  SceneObjectBase,
  SceneComponentProps,
  SceneObjectUrlSyncConfig,
  SceneObjectUrlValues,
  sceneGraph,
  SceneVariableSet,
  QueryVariable,
} from '@grafana/scenes';
import { ToolbarButton, Box, Stack, Icon, TabsBar, Tab, useStyles2, LinkButton, Tooltip } from '@grafana/ui';

import { getExploreUrl } from '../../core/utils/explore';

import { buildBreakdownActionScene } from './ActionTabs/BreakdownScene';
import { buildMetricOverviewScene } from './ActionTabs/MetricOverviewScene';
import { buildRelatedMetricsScene } from './ActionTabs/RelatedMetricsScene';
import { LayoutType } from './ActionTabs/types';
import { getAutoQueriesForMetric } from './AutomaticMetricQueries/AutoQueryEngine';
import { AutoQueryDef, AutoQueryInfo } from './AutomaticMetricQueries/types';
import { MAIN_PANEL_MAX_HEIGHT, MAIN_PANEL_MIN_HEIGHT, MetricGraphScene } from './MetricGraphScene';
import { ShareTrailButton } from './ShareTrailButton';
import { useBookmarkState } from './TrailStore/useBookmarkState';
import { reportExploreMetrics } from './interactions';
import {
  ActionViewDefinition,
  ActionViewType,
  getVariablesWithMetricConstant,
  MakeOptional,
  MetricSelectedEvent,
  TRAIL_BREAKDOWN_VIEW_KEY,
  trailDS,
  VAR_GROUP_BY,
  VAR_METRIC_EXPR,
} from './shared';
import { getDataSource, getTrailFor, getUrlForTrail } from './utils';

export interface MetricSceneState extends SceneObjectState {
  body: MetricGraphScene;
  metric: string;
  actionView?: string;
  layout: LayoutType;

  autoQuery: AutoQueryInfo;
  queryDef?: AutoQueryDef;
}

export class MetricScene extends SceneObjectBase<MetricSceneState> {
  protected _urlSync = new SceneObjectUrlSyncConfig(this, { keys: ['actionView', 'layout'] });

  public constructor(state: MakeOptional<MetricSceneState, 'body' | 'autoQuery' | 'layout'>) {
    const autoQuery = state.autoQuery ?? getAutoQueriesForMetric(state.metric);
    const layout = localStorage.getItem(TRAIL_BREAKDOWN_VIEW_KEY) ?? 'grid';
    super({
      $variables: state.$variables ?? getVariableSet(state.metric),
      body: state.body ?? new MetricGraphScene({}),
      autoQuery,
      queryDef: state.queryDef ?? autoQuery.main,
      layout: isLayoutType(layout) ? layout : 'grid',
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
    return { actionView: this.state.actionView, layout: this.state.layout };
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

    if (typeof values.layout === 'string') {
      const newLayout = values.layout as LayoutType;
      if (this.state.layout !== newLayout) {
        this.setState({ layout: newLayout });
      }
    }
  }

  public setActionView(actionView?: ActionViewType) {
    const { body } = this.state;
    const actionViewDef = actionViewsDefinitions.find((v) => v.value === actionView);

    if (actionViewDef && actionViewDef.value !== this.state.actionView) {
      // reduce max height for main panel to reduce height flicker
      body.state.topView.state.children[0].setState({ maxHeight: MAIN_PANEL_MIN_HEIGHT });
      body.setState({ selectedTab: actionViewDef.getScene() });
      this.setState({ actionView: actionViewDef.value });
    } else {
      // restore max height
      body.state.topView.state.children[0].setState({ maxHeight: MAIN_PANEL_MAX_HEIGHT });
      body.setState({ selectedTab: undefined });
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
  {
    displayName: 'Related metrics',
    value: 'related',
    getScene: buildRelatedMetricsScene,
    description: 'Relevant metrics based on current label filters',
  },
];

export interface MetricActionBarState extends SceneObjectState {}

export class MetricActionBar extends SceneObjectBase<MetricActionBarState> {
  public getLinkToExplore = async () => {
    const metricScene = sceneGraph.getAncestor(this, MetricScene);
    const trail = getTrailFor(this);
    const dsValue = getDataSource(trail);

    const queries = metricScene.state.queryDef?.queries || [];
    const timeRange = sceneGraph.getTimeRange(this);

    return getExploreUrl({
      queries,
      dsRef: { uid: dsValue },
      timeRange: timeRange.state.value,
      scopedVars: { __sceneObject: { value: metricScene } },
    });
  };

  public openExploreLink = async () => {
    reportExploreMetrics('selected_metric_action_clicked', { action: 'open_in_explore' });
    this.getLinkToExplore().then((link) => {
      // We need to ensure we prefix with the appSubUrl for environments that don't host grafana at the root.
      const url = `${config.appSubUrl}${link}`;
      // We use window.open instead of a Link or <a> because we want to compute the explore link when clicking,
      // if we precompute it we have to keep track of a lot of dependencies
      window.open(url, '_blank');
    });
  };

  public static Component = ({ model }: SceneComponentProps<MetricActionBar>) => {
    const metricScene = sceneGraph.getAncestor(model, MetricScene);
    const styles = useStyles2(getStyles);
    const trail = getTrailFor(model);
    const [isBookmarked, toggleBookmark] = useBookmarkState(trail);
    const { actionView } = metricScene.useState();

    return (
      <Box paddingY={1}>
        <div className={styles.actions}>
          <Stack gap={1}>
            <ToolbarButton
              variant={'canvas'}
              tooltip="Remove existing metric and choose a new metric"
              onClick={() => {
                reportExploreMetrics('selected_metric_action_clicked', { action: 'unselect' });
                trail.publishEvent(new MetricSelectedEvent(undefined));
              }}
            >
              Select new metric
            </ToolbarButton>
            <ToolbarButton
              variant={'canvas'}
              icon="compass"
              tooltip="Open in explore"
              onClick={model.openExploreLink}
            ></ToolbarButton>
            <ShareTrailButton trail={trail} />
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
              onClick={toggleBookmark}
            />
            {trail.state.embedded && (
              <LinkButton
                href={getUrlForTrail(trail)}
                variant={'secondary'}
                onClick={() => reportExploreMetrics('selected_metric_action_clicked', { action: 'open_from_embedded' })}
              >
                Open
              </LinkButton>
            )}
          </Stack>
        </div>

        <TabsBar>
          {actionViewsDefinitions.map((tab, index) => {
            const tabRender = (
              <Tab
                key={index}
                label={tab.displayName}
                active={actionView === tab.value}
                onChangeTab={() => {
                  reportExploreMetrics('metric_action_view_changed', { view: tab.value });
                  metricScene.setActionView(tab.value);
                }}
              />
            );

            if (tab.description) {
              return (
                <Tooltip key={index} content={tab.description} placement="bottom-start" theme="info">
                  {tabRender}
                </Tooltip>
              );
            }
            return tabRender;
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
        top: 16,
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
