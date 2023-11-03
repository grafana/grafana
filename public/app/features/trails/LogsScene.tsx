import React from 'react';

import {
  SceneObjectState,
  SceneObjectBase,
  SceneComponentProps,
  SceneFlexLayout,
  SceneFlexItem,
  SceneQueryRunner,
  SceneObjectUrlSyncConfig,
  SceneObjectUrlValues,
  sceneGraph,
  PanelBuilders,
} from '@grafana/scenes';
import { GraphDrawStyle, StackingMode } from '@grafana/schema';
import { Icon, Input, ToolbarButton, Stack, Box } from '@grafana/ui';
import { PromQuery } from 'app/plugins/datasource/prometheus/types';

import {
  ActionViewDefinition,
  KEY_SQR_METRIC_VIZ_QUERY,
  LOGS_METRIC,
  MakeOptional,
  OpenEmbeddedTrailEvent,
  trailDS,
} from './shared';
import { showOnlyInAdvanced } from './showOnlyInAdvanced';
import { getParentOfType, getTrailFor } from './utils';

export interface LogsSceneState extends SceneObjectState {
  body: SceneFlexLayout;
  actionView?: string;
}

export class LogsScene extends SceneObjectBase<LogsSceneState> {
  protected _urlSync = new SceneObjectUrlSyncConfig(this, { keys: ['actionView'] });

  public constructor(state: MakeOptional<LogsSceneState, 'body'>) {
    super({
      body: state.body ?? buildLogsScene(),
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

  static Component = ({ model }: SceneComponentProps<LogsScene>) => {
    const { body } = model.useState();
    return <body.Component model={body} />;
  };
}

const actionViewsDefinitions: ActionViewDefinition[] = [];

export interface MetricActionBarState extends SceneObjectState {}

export class MetricActionBar extends SceneObjectBase<MetricActionBarState> {
  public getButtonVariant(actionViewName: string, currentView: string | undefined) {
    return currentView === actionViewName ? 'active' : 'canvas';
  }

  public onOpenTrail = () => {
    this.publishEvent(new OpenEmbeddedTrailEvent(), true);
  };

  public static Component = ({ model }: SceneComponentProps<MetricActionBar>) => {
    const logsScene = getParentOfType(model, LogsScene);
    const trail = getTrailFor(model);
    const { actionView } = logsScene.useState();

    return (
      <Box paddingY={1}>
        <Stack gap={2}>
          {actionViewsDefinitions.map((viewDef) => (
            <ToolbarButton
              key={viewDef.value}
              variant={viewDef.value === actionView ? 'active' : 'canvas'}
              onClick={() => logsScene.setActionView(viewDef)}
            >
              {viewDef.displayName}
            </ToolbarButton>
          ))}
          <ToolbarButton variant={'canvas'}>Breakdown</ToolbarButton>
          <ToolbarButton variant={'canvas'}>Related metrics</ToolbarButton>
          <ToolbarButton variant={'canvas'}>Add to dashboard</ToolbarButton>
          <ToolbarButton variant={'canvas'} icon="compass" tooltip="Open in explore" />
          <ToolbarButton variant={'canvas'} icon="star" tooltip="Bookmark" />
          <ToolbarButton variant={'canvas'} icon="share-alt" />
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

function buildLogsScene() {
  return new SceneFlexLayout({
    direction: 'column',
    children: [
      new SceneFlexItem({
        minHeight: 150,
        maxHeight: 150,
        $data: new SceneQueryRunner({
          maxDataPoints: 150,
          queries: [
            {
              refId: 'A',
              datasource: trailDS,
              legendFormat: `{{level}}`,
              expr: 'sum by (level) (count_over_time({${filters}} |= `` | logfmt[$__auto]))',
            },
          ],
        }),
        body: PanelBuilders.timeseries()
          .setTitle('Log volume')
          .setOption('legend', { placement: 'right' })
          .setCustomFieldConfig('stacking', { mode: StackingMode.Normal })
          .setCustomFieldConfig('drawStyle', GraphDrawStyle.Bars)
          .setCustomFieldConfig('fillOpacity', 80)
          .build(),
      }),
      new SceneFlexItem({
        ySizing: 'content',
        body: new MetricActionBar({}),
      }),
      new SceneFlexItem({
        minHeight: 350,
        $data: new SceneQueryRunner({
          queries: [
            {
              refId: 'A',
              datasource: trailDS,
              expr: '{${filters}} | logfmt',
            },
          ],
        }),
        body: PanelBuilders.logs().setTitle('Logs').build(),
      }),
      new SceneFlexItem({
        ySizing: 'content',
        isHidden: true,
        $behaviors: [showOnlyInAdvanced],
        body: new QueryDebugView({}),
      }),
    ],
  });
}

export interface QueryDebugViewState extends SceneObjectState {}

export class QueryDebugView extends SceneObjectBase<QueryDebugViewState> {
  public static Component = ({ model }: SceneComponentProps<QueryDebugView>) => {
    const queryRunner = sceneGraph.findObject(model, (x) => x.state.key === KEY_SQR_METRIC_VIZ_QUERY);
    if (!(queryRunner instanceof SceneQueryRunner)) {
      return;
    }

    const query = queryRunner?.state.queries[0] as PromQuery;
    return <div className="small">{sceneGraph.interpolate(model, query.expr)}</div>;
  };
}

export interface LogsSearchState extends SceneObjectState {}

export class LogsSearch extends SceneObjectBase<LogsSearchState> {
  public static Component = ({ model }: SceneComponentProps<LogsSearch>) => {
    const { metric } = getTrailFor(model).useState();
    if (metric !== LOGS_METRIC) {
      return null;
    }

    return <Input placeholder="Search logs" prefix={<Icon name="search" />} width={50} />;
  };
}
