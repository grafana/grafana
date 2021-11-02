import { __assign, __read } from "tslib";
import { dateMath, FieldColorModeId, } from '@grafana/data';
import { Table } from '@grafana/ui';
import { config } from 'app/core/config';
import React, { useMemo, useState } from 'react';
import { useObservable } from 'react-use';
import { QueryGroup } from '../query/components/QueryGroup';
import { PanelQueryRunner } from '../query/state/PanelQueryRunner';
import Page from '../../core/components/Page/Page';
import AutoSizer from 'react-virtualized-auto-sizer';
import { PanelRenderer } from '../panel/components/PanelRenderer';
export var TestStuffPage = function () {
    var _a = __read(useState(getDefaultState()), 2), state = _a[0], setState = _a[1];
    var queryOptions = state.queryOptions, queryRunner = state.queryRunner;
    var onRunQueries = function () {
        var _a;
        var timeRange = { from: 'now-1h', to: 'now' };
        queryRunner.run({
            queries: queryOptions.queries,
            datasource: queryOptions.dataSource,
            timezone: 'browser',
            timeRange: { from: dateMath.parse(timeRange.from), to: dateMath.parse(timeRange.to), raw: timeRange },
            maxDataPoints: (_a = queryOptions.maxDataPoints) !== null && _a !== void 0 ? _a : 100,
            minInterval: queryOptions.minInterval,
        });
    };
    var onOptionsChange = function (queryOptions) {
        setState(__assign(__assign({}, state), { queryOptions: queryOptions }));
    };
    /**
     * Subscribe to data
     */
    var observable = useMemo(function () { return queryRunner.getData({ withFieldConfig: true, withTransforms: true }); }, [queryRunner]);
    var data = useObservable(observable);
    var node = {
        id: 'test-page',
        text: 'Test page',
        icon: 'dashboard',
        subTitle: 'FOR TESTING!',
        url: 'sandbox/test',
    };
    return (React.createElement(Page, { navModel: { node: node, main: node } },
        React.createElement(Page.Contents, null,
            data && (React.createElement(AutoSizer, { style: { width: '100%', height: '600px' } }, function (_a) {
                var width = _a.width;
                return (React.createElement("div", null,
                    React.createElement(PanelRenderer, { title: "Hello", pluginId: "timeseries", width: width, height: 300, data: data, options: {}, fieldConfig: { defaults: {}, overrides: [] }, timeZone: "browser" }),
                    React.createElement(Table, { data: data.series[0], width: width, height: 300 })));
            })),
            React.createElement("div", { style: { marginTop: '16px', height: '45%' } },
                React.createElement(QueryGroup, { options: queryOptions, queryRunner: queryRunner, onRunQueries: onRunQueries, onOptionsChange: onOptionsChange })))));
};
export function getDefaultState() {
    var options = {
        fieldConfig: {
            defaults: {
                color: {
                    mode: FieldColorModeId.PaletteClassic,
                },
            },
            overrides: [],
        },
        replaceVariables: function (v) { return v; },
        theme: config.theme2,
    };
    var dataConfig = {
        getTransformations: function () { return []; },
        getFieldOverrideOptions: function () { return options; },
        getDataSupport: function () { return ({ annotations: false, alertStates: false }); },
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
export default TestStuffPage;
//# sourceMappingURL=TestStuffPage.js.map