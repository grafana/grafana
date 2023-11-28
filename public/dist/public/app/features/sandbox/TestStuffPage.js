import React, { useMemo, useState } from 'react';
import { useObservable } from 'react-use';
import AutoSizer from 'react-virtualized-auto-sizer';
import { dateMath, FieldColorModeId } from '@grafana/data';
import { getPluginExtensions, isPluginExtensionLink } from '@grafana/runtime';
import { Button, HorizontalGroup, LinkButton, Table } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { config } from 'app/core/config';
import { useAppNotification } from 'app/core/copy/appNotification';
import { PanelRenderer } from '../panel/components/PanelRenderer';
import { QueryGroup } from '../query/components/QueryGroup';
import { PanelQueryRunner } from '../query/state/PanelQueryRunner';
export const TestStuffPage = () => {
    const [state, setState] = useState(getDefaultState());
    const { queryOptions, queryRunner } = state;
    const onRunQueries = () => {
        var _a;
        const timeRange = { from: 'now-1h', to: 'now' };
        queryRunner.run({
            queries: queryOptions.queries,
            datasource: queryOptions.dataSource,
            timezone: 'browser',
            timeRange: { from: dateMath.parse(timeRange.from), to: dateMath.parse(timeRange.to), raw: timeRange },
            maxDataPoints: (_a = queryOptions.maxDataPoints) !== null && _a !== void 0 ? _a : 100,
            minInterval: queryOptions.minInterval,
        });
    };
    const onOptionsChange = (queryOptions) => {
        setState(Object.assign(Object.assign({}, state), { queryOptions }));
    };
    /**
     * Subscribe to data
     */
    const observable = useMemo(() => queryRunner.getData({ withFieldConfig: true, withTransforms: true }), [queryRunner]);
    const data = useObservable(observable);
    const node = {
        id: 'test-page',
        text: 'Test page',
        icon: 'dashboard',
        subTitle: 'FOR TESTING!',
        url: 'sandbox/test',
    };
    const notifyApp = useAppNotification();
    return (React.createElement(Page, { navModel: { node: node, main: node } },
        React.createElement(Page.Contents, null,
            React.createElement(HorizontalGroup, null,
                React.createElement(LinkToBasicApp, { extensionPointId: "grafana/sandbox/testing" })),
            data && (React.createElement(AutoSizer, { style: { width: '100%', height: '600px' } }, ({ width }) => {
                return (React.createElement("div", null,
                    React.createElement(PanelRenderer, { title: "Hello", pluginId: "timeseries", width: width, height: 300, data: data, options: {}, fieldConfig: { defaults: {}, overrides: [] }, timeZone: "browser" }),
                    React.createElement(Table, { data: data.series[0], width: width, height: 300 })));
            })),
            React.createElement("div", { style: { marginTop: '16px', height: '45%' } },
                React.createElement(QueryGroup, { options: queryOptions, queryRunner: queryRunner, onRunQueries: onRunQueries, onOptionsChange: onOptionsChange })),
            React.createElement("div", { style: { display: 'flex', gap: '1em' } },
                React.createElement(Button, { onClick: () => notifyApp.success('Success toast', 'some more text goes here'), variant: "primary" }, "Success"),
                React.createElement(Button, { onClick: () => notifyApp.warning('Warning toast', 'some more text goes here', 'bogus-trace-99999'), variant: "secondary" }, "Warning"),
                React.createElement(Button, { onClick: () => notifyApp.error('Error toast', 'some more text goes here', 'bogus-trace-fdsfdfsfds'), variant: "destructive" }, "Error")))));
};
export function getDefaultState() {
    const options = {
        fieldConfig: {
            defaults: {
                color: {
                    mode: FieldColorModeId.PaletteClassic,
                },
            },
            overrides: [],
        },
        replaceVariables: (v) => v,
        theme: config.theme2,
    };
    const dataConfig = {
        getTransformations: () => [],
        getFieldOverrideOptions: () => options,
        getDataSupport: () => ({ annotations: false, alertStates: false }),
    };
    return {
        queryRunner: new PanelQueryRunner(dataConfig),
        queryOptions: {
            queries: [],
            dataSource: {
                name: 'gdev-testdata',
            },
            maxDataPoints: 100,
        },
    };
}
function LinkToBasicApp({ extensionPointId }) {
    const { extensions } = getPluginExtensions({ extensionPointId });
    if (extensions.length === 0) {
        return null;
    }
    return (React.createElement("div", null, extensions.map((extension, i) => {
        if (!isPluginExtensionLink(extension)) {
            return null;
        }
        return (React.createElement(LinkButton, { href: extension.path, title: extension.description, key: extension.id }, extension.title));
    })));
}
export default TestStuffPage;
//# sourceMappingURL=TestStuffPage.js.map