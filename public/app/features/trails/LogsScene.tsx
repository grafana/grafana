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
import { GraphDrawStyle } from '@grafana/schema';
import { ToolbarButton } from '@grafana/ui';
import { Box, Flex } from '@grafana/ui/src/unstable';
import { PromQuery } from 'app/plugins/datasource/prometheus/types';

import { onlyShowInDebugBehavior } from './onlyShowInDebugBehavior';
import { ActionViewDefinition, KEY_SQR_METRIC_VIZ_QUERY, MakeOptional, OpenEmbeddedTrailEvent } from './shared';
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
        <Flex gap={2}>
          {actionViewsDefinitions.map((viewDef) => (
            <ToolbarButton
              key={viewDef.value}
              variant={viewDef.value === actionView ? 'active' : 'canvas'}
              onClick={() => logsScene.setActionView(viewDef)}
            >
              {viewDef.displayName}
            </ToolbarButton>
          ))}
          <ToolbarButton variant={'canvas'}>Add to dashboard</ToolbarButton>
          <ToolbarButton variant={'canvas'} icon="bookmark" />
          <ToolbarButton variant={'canvas'} icon="share-alt" />
          {trail.state.embedded && (
            <ToolbarButton variant={'canvas'} onClick={model.onOpenTrail}>
              Open
            </ToolbarButton>
          )}
        </Flex>
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
          queries: [
            {
              refId: 'A',
              datasource: { uid: 'gdev-loki' },
              expr: 'sum by (level) (count_over_time({${filters}} |= `` | logfmt[$__auto]))',
            },
          ],
        }),
        body: PanelBuilders.timeseries()
          .setTitle('Log volume')
          .setCustomFieldConfig('drawStyle', GraphDrawStyle.Bars)
          .build(),
      }),
      new SceneFlexItem({
        minHeight: 350,
        $data: new SceneQueryRunner({
          queries: [
            {
              refId: 'A',
              datasource: { uid: 'gdev-loki' },
              expr: '{${filters}} | logfmt',
            },
          ],
        }),
        body: PanelBuilders.logs().setTitle('Logs').build(),
      }),
      new SceneFlexItem({
        ySizing: 'content',
        isHidden: true,
        $behaviors: [onlyShowInDebugBehavior],
        body: new QueryDebugView({}),
      }),
      new SceneFlexItem({
        ySizing: 'content',
        body: new MetricActionBar({}),
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
