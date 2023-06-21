import React from 'react';

import {
  SceneFlexLayout,
  SceneTimePicker,
  VizPanel,
  EmbeddedScene,
  SceneTimeRange,
  VariableValueSelectors,
  SceneControlsSpacer,
  SceneRefreshPicker,
  SceneFlexItem,
  SceneObjectState,
  SceneObjectBase,
  SceneObjectUrlSyncConfig,
  SceneObjectUrlValues,
} from '@grafana/scenes';
import { Button } from '@grafana/ui';

import { getInstantQuery, getTimeSeriesQuery, getVariablesDefinitions } from './utils';

export function getTrafficScene(): EmbeddedScene {
  const httpHandlersTable = new VizPanel({
    $data: getInstantQuery({
      expr: 'sort_desc(avg without(job, instance) (rate(grafana_http_request_duration_seconds_sum[$__rate_interval]) * 1e3)) ',
    }),
    pluginId: 'table',
    title: 'Handlers',
    options: {
      footer: {
        enablePagination: true,
      },
    },
    fieldConfig: {
      defaults: {},
      overrides: [
        {
          matcher: {
            id: 'byRegexp',
            options: '.*',
          },
          properties: [{ id: 'filterable', value: false }],
        },
        {
          matcher: {
            id: 'byName',
            options: 'Time',
          },
          properties: [{ id: 'custom.hidden', value: true }],
        },
        {
          matcher: {
            id: 'byName',
            options: 'Value',
          },
          properties: [{ id: 'displayName', value: 'Duration (Avg)' }],
        },
        {
          matcher: {
            id: 'byName',
            options: 'handler',
          },
          properties: [
            {
              id: 'links',
              value: [
                {
                  title: 'Go to handler drilldown view',
                  url: '/scenes/grafana-monitoring/traffic?handler=${__value.text:percentencode}',
                  // onBuildUrl: () => {
                  //   const params = locationService.getSearchObject();
                  //   return getLinkUrlWithAppUrlState('/scenes/grafana-monitoring/traffic', {
                  //     ...params,
                  //     handler: '${__value.text:percentencode}',
                  //   });
                  // },
                },
              ],
            },
          ],
        },
      ],
    },
  });

  const scene = new EmbeddedScene({
    $variables: getVariablesDefinitions(),
    $timeRange: new SceneTimeRange({ from: 'now-1h', to: 'now' }),
    controls: [
      new VariableValueSelectors({}),
      new SceneControlsSpacer(),
      new SceneTimePicker({ isOnCanvas: true }),
      new SceneRefreshPicker({ isOnCanvas: true }),
    ],
    body: new SceneFlexLayout({
      $behaviors: [new HandlerDrilldownViewBehavior()],
      children: [new SceneFlexItem({ body: httpHandlersTable })],
    }),
  });

  return scene;
}

export interface HandlerDrilldownViewBehaviorState extends SceneObjectState {
  handler?: string;
}

export class HandlerDrilldownViewBehavior extends SceneObjectBase<HandlerDrilldownViewBehaviorState> {
  protected _urlSync = new SceneObjectUrlSyncConfig(this, { keys: ['handler'] });

  public constructor() {
    super({});

    this.addActivationHandler(() => {
      this._subs.add(this.subscribeToState((state) => this.onHandlerChanged(state.handler)));
      this.onHandlerChanged(this.state.handler);
    });
  }

  private onHandlerChanged(handler: string | undefined) {
    const layout = this.getLayout();

    if (handler == null) {
      layout.setState({ children: layout.state.children.slice(0, 1) });
    } else {
      layout.setState({ children: [layout.state.children[0], this.getDrilldownView(handler)] });
    }
  }

  private getDrilldownView(handler: string): SceneFlexItem {
    return new SceneFlexItem({
      key: 'drilldown-flex',
      body: new VizPanel({
        $data: getTimeSeriesQuery({
          expr: `rate(grafana_http_request_duration_seconds_sum{handler="${handler}"}[$__rate_interval]) * 1e3`,
        }),
        pluginId: 'timeseries',
        title: `Handler: ${handler} details`,
        headerActions: (
          <Button size="sm" variant="secondary" icon="times" onClick={() => this.setState({ handler: undefined })} />
        ),
      }),
    });
  }

  public getUrlState() {
    return { handler: this.state.handler };
  }

  public updateFromUrl(values: SceneObjectUrlValues) {
    if (typeof values.handler === 'string' || values.handler === undefined) {
      this.setState({ handler: values.handler });
    }
  }

  private getLayout() {
    if (this.parent instanceof SceneFlexLayout) {
      return this.parent;
    }

    throw new Error('Invalid parent');
  }
}
