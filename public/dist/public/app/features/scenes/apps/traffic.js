import React from 'react';
import { SceneFlexLayout, SceneTimePicker, EmbeddedScene, SceneTimeRange, VariableValueSelectors, SceneControlsSpacer, SceneRefreshPicker, SceneFlexItem, SceneObjectBase, SceneObjectUrlSyncConfig, PanelBuilders, } from '@grafana/scenes';
import { Button } from '@grafana/ui';
import { getInstantQuery, getTimeSeriesQuery, getVariablesDefinitions } from './utils';
export function getTrafficScene() {
    const httpHandlersTable = PanelBuilders.table()
        .setData(getInstantQuery({
        expr: 'sort_desc(avg without(job, instance) (rate(grafana_http_request_duration_seconds_sum[$__rate_interval]) * 1e3)) ',
    }))
        .setTitle('Handlers')
        .setOption('footer', { enablePagination: true })
        .setOverrides((b) => b
        .matchFieldsWithNameByRegex('.*')
        .overrideFilterable(false)
        .matchFieldsWithName('Time')
        .overrideCustomFieldConfig('hidden', true)
        .matchFieldsWithName('Value')
        .overrideDisplayName('Duration (Avg)')
        .matchFieldsWithName('handler')
        .overrideLinks([
        {
            title: 'Go to handler drilldown view',
            url: '/scenes/grafana-monitoring/traffic?handler=${__value.text:percentencode}',
        },
    ]))
        .build();
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
export class HandlerDrilldownViewBehavior extends SceneObjectBase {
    constructor() {
        super({});
        this._urlSync = new SceneObjectUrlSyncConfig(this, { keys: ['handler'] });
        this.addActivationHandler(() => {
            this._subs.add(this.subscribeToState((state) => this.onHandlerChanged(state.handler)));
            this.onHandlerChanged(this.state.handler);
        });
    }
    onHandlerChanged(handler) {
        const layout = this.getLayout();
        if (handler == null) {
            layout.setState({ children: layout.state.children.slice(0, 1) });
        }
        else {
            layout.setState({ children: [layout.state.children[0], this.getDrilldownView(handler)] });
        }
    }
    getDrilldownView(handler) {
        return new SceneFlexItem({
            key: 'drilldown-flex',
            body: PanelBuilders.timeseries()
                .setData(getTimeSeriesQuery({
                expr: `rate(grafana_http_request_duration_seconds_sum{handler="${handler}"}[$__rate_interval]) * 1e3`,
            }))
                .setTitle(`Handler: ${handler} details`)
                .setHeaderActions(React.createElement(Button, { size: "sm", variant: "secondary", icon: "times", onClick: () => this.setState({ handler: undefined }) }))
                .build(),
        });
    }
    getUrlState() {
        return { handler: this.state.handler };
    }
    updateFromUrl(values) {
        if (typeof values.handler === 'string' || values.handler === undefined) {
            this.setState({ handler: values.handler });
        }
    }
    getLayout() {
        if (this.parent instanceof SceneFlexLayout) {
            return this.parent;
        }
        throw new Error('Invalid parent');
    }
}
//# sourceMappingURL=traffic.js.map