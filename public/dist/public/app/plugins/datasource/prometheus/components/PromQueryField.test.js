import { __assign, __awaiter, __generator, __read, __spreadArray } from "tslib";
import React from 'react';
import PromQueryField from './PromQueryField';
import { LoadingState } from '@grafana/data';
import { render, screen } from '@testing-library/react';
describe('PromQueryField', function () {
    beforeAll(function () {
        // @ts-ignore
        window.getSelection = function () { };
    });
    it('renders metrics chooser regularly if lookups are not disabled in the datasource settings', function () {
        var datasource = {
            languageProvider: {
                start: function () { return Promise.resolve([]); },
                syntax: function () { },
                getLabelKeys: function () { return []; },
                metrics: [],
            },
            getInitHints: function () { return []; },
        };
        var queryField = render(React.createElement(PromQueryField
        // @ts-ignore
        , { 
            // @ts-ignore
            datasource: datasource, query: { expr: '', refId: '' }, onRunQuery: function () { }, onChange: function () { }, history: [] }));
        expect(queryField.getAllByRole('button')).toHaveLength(1);
    });
    it('renders a disabled metrics chooser if lookups are disabled in datasource settings', function () {
        var datasource = {
            languageProvider: {
                start: function () { return Promise.resolve([]); },
                syntax: function () { },
                getLabelKeys: function () { return []; },
                metrics: [],
            },
            getInitHints: function () { return []; },
        };
        var queryField = render(React.createElement(PromQueryField
        // @ts-ignore
        , { 
            // @ts-ignore
            datasource: __assign(__assign({}, datasource), { lookupsDisabled: true }), query: { expr: '', refId: '' }, onRunQuery: function () { }, onChange: function () { }, history: [] }));
        var bcButton = queryField.getByRole('button');
        expect(bcButton).toBeDisabled();
    });
    it('renders an initial hint if no data and initial hint provided', function () {
        var datasource = {
            languageProvider: {
                start: function () { return Promise.resolve([]); },
                syntax: function () { },
                getLabelKeys: function () { return []; },
                metrics: [],
            },
            getInitHints: function () { return [{ label: 'Initial hint', type: 'INFO' }]; },
        };
        render(React.createElement(PromQueryField
        // @ts-ignore
        , { 
            // @ts-ignore
            datasource: __assign(__assign({}, datasource), { lookupsDisabled: true }), query: { expr: '', refId: '' }, onRunQuery: function () { }, onChange: function () { }, history: [] }));
        expect(screen.getByText('Initial hint')).toBeInTheDocument();
    });
    it('renders query hint if data, query hint and initial hint provided', function () {
        var datasource = {
            languageProvider: {
                start: function () { return Promise.resolve([]); },
                syntax: function () { },
                getLabelKeys: function () { return []; },
                metrics: [],
            },
            getInitHints: function () { return [{ label: 'Initial hint', type: 'INFO' }]; },
            getQueryHints: function () { return [{ label: 'Query hint', type: 'INFO' }]; },
        };
        render(React.createElement(PromQueryField
        // @ts-ignore
        , { 
            // @ts-ignore
            datasource: __assign({}, datasource), query: { expr: '', refId: '' }, onRunQuery: function () { }, onChange: function () { }, history: [], data: {
                series: [{ name: 'test name' }],
                state: LoadingState.Done,
            } }));
        expect(screen.getByText('Query hint')).toBeInTheDocument();
        expect(screen.queryByText('Initial hint')).not.toBeInTheDocument();
    });
    it('refreshes metrics when the data source changes', function () { return __awaiter(void 0, void 0, void 0, function () {
        var defaultProps, metrics, queryField, changedMetrics, labelBrowser;
        return __generator(this, function (_a) {
            defaultProps = {
                query: { expr: '', refId: '' },
                onRunQuery: function () { },
                onChange: function () { },
                history: [],
            };
            metrics = ['foo', 'bar'];
            queryField = render(React.createElement(PromQueryField
            // @ts-ignore
            , __assign({ 
                // @ts-ignore
                datasource: {
                    languageProvider: makeLanguageProvider({ metrics: [metrics] }),
                    getInitHints: function () { return []; },
                } }, defaultProps)));
            changedMetrics = ['baz', 'moo'];
            queryField.rerender(React.createElement(PromQueryField
            // @ts-ignore
            , __assign({ 
                // @ts-ignore
                datasource: {
                    languageProvider: makeLanguageProvider({ metrics: [changedMetrics] }),
                } }, defaultProps)));
            labelBrowser = screen.getByRole('button');
            expect(labelBrowser.textContent).toContain('Loading');
            return [2 /*return*/];
        });
    }); });
});
function makeLanguageProvider(options) {
    var metricsStack = __spreadArray([], __read(options.metrics), false);
    return {
        histogramMetrics: [],
        metrics: [],
        metricsMetadata: {},
        lookupsDisabled: false,
        getLabelKeys: function () { return []; },
        start: function () {
            this.metrics = metricsStack.shift();
            return Promise.resolve([]);
        },
    };
}
//# sourceMappingURL=PromQueryField.test.js.map