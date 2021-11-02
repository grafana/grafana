import { __assign, __awaiter, __generator } from "tslib";
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import Wrapper from './Wrapper';
import { configureStore } from '../../store/configureStore';
import { Provider } from 'react-redux';
import { locationService, setDataSourceSrv, setEchoSrv } from '@grafana/runtime';
import { ArrayDataFrame, FieldType, } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { from } from 'rxjs';
import { fromPairs } from 'lodash';
import userEvent from '@testing-library/user-event';
import { splitOpen } from './state/main';
import { Route, Router } from 'react-router-dom';
import { GrafanaRoute } from 'app/core/navigation/GrafanaRoute';
import { initialUserState } from '../profile/state/reducers';
import { Echo } from 'app/core/services/echo/Echo';
jest.mock('app/core/core', function () {
    return {
        contextSrv: {
            hasPermission: function () { return true; },
        },
    };
});
jest.mock('react-virtualized-auto-sizer', function () {
    return {
        __esModule: true,
        default: function (props) {
            return React.createElement("div", null, props.children({ width: 1000 }));
        },
    };
});
describe('Wrapper', function () {
    it('shows warning if there are no data sources', function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            setup({ datasources: [] });
            // Will throw if isn't found
            screen.getByText(/Explore requires at least one data source/i);
            return [2 /*return*/];
        });
    }); });
    it('inits url and renders editor but does not call query on empty url', function () { return __awaiter(void 0, void 0, void 0, function () {
        var datasources;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    datasources = setup().datasources;
                    // Wait for rendering the editor
                    return [4 /*yield*/, screen.findByText(/Editor/i)];
                case 1:
                    // Wait for rendering the editor
                    _a.sent();
                    // At this point url should be initialised to some defaults
                    expect(locationService.getSearchObject()).toEqual({
                        orgId: '1',
                        left: JSON.stringify(['now-1h', 'now', 'loki', { refId: 'A' }]),
                    });
                    expect(datasources.loki.query).not.toBeCalled();
                    return [2 /*return*/];
            }
        });
    }); });
    it('runs query when url contains query and renders results', function () { return __awaiter(void 0, void 0, void 0, function () {
        var query, _a, datasources, store;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    query = { left: JSON.stringify(['now-1h', 'now', 'loki', { expr: '{ label="value"}', refId: 'A' }]) };
                    _a = setup({ query: query }), datasources = _a.datasources, store = _a.store;
                    datasources.loki.query.mockReturnValueOnce(makeLogsQueryResponse());
                    // Make sure we render the logs panel
                    return [4 /*yield*/, screen.findByText(/^Logs$/)];
                case 1:
                    // Make sure we render the logs panel
                    _b.sent();
                    // Make sure we render the log line
                    return [4 /*yield*/, screen.findByText(/custom log line/i)];
                case 2:
                    // Make sure we render the log line
                    _b.sent();
                    // And that the editor gets the expr from the url
                    return [4 /*yield*/, screen.findByText("loki Editor input: { label=\"value\"}")];
                case 3:
                    // And that the editor gets the expr from the url
                    _b.sent();
                    // We did not change the url
                    expect(locationService.getSearchObject()).toEqual(__assign({ orgId: '1' }, query));
                    expect(store.getState().explore.richHistory[0]).toMatchObject({
                        datasourceId: '1',
                        datasourceName: 'loki',
                        queries: [{ expr: '{ label="value"}', refId: 'A' }],
                    });
                    // We called the data source query method once
                    expect(datasources.loki.query).toBeCalledTimes(1);
                    expect(datasources.loki.query.mock.calls[0][0]).toMatchObject({
                        targets: [{ expr: '{ label="value"}' }],
                    });
                    return [2 /*return*/];
            }
        });
    }); });
    it('handles url change and runs the new query', function () { return __awaiter(void 0, void 0, void 0, function () {
        var query, datasources;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    query = { left: JSON.stringify(['now-1h', 'now', 'loki', { expr: '{ label="value"}' }]) };
                    datasources = setup({ query: query }).datasources;
                    datasources.loki.query.mockReturnValueOnce(makeLogsQueryResponse());
                    // Wait for rendering the logs
                    return [4 /*yield*/, screen.findByText(/custom log line/i)];
                case 1:
                    // Wait for rendering the logs
                    _a.sent();
                    datasources.loki.query.mockReturnValueOnce(makeLogsQueryResponse('different log'));
                    locationService.partial({
                        left: JSON.stringify(['now-1h', 'now', 'loki', { expr: '{ label="different"}' }]),
                    });
                    // Editor renders the new query
                    return [4 /*yield*/, screen.findByText("loki Editor input: { label=\"different\"}")];
                case 2:
                    // Editor renders the new query
                    _a.sent();
                    // Renders new response
                    return [4 /*yield*/, screen.findByText(/different log/i)];
                case 3:
                    // Renders new response
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it('handles url change and runs the new query with different datasource', function () { return __awaiter(void 0, void 0, void 0, function () {
        var query, datasources;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    query = { left: JSON.stringify(['now-1h', 'now', 'loki', { expr: '{ label="value"}' }]) };
                    datasources = setup({ query: query }).datasources;
                    datasources.loki.query.mockReturnValueOnce(makeLogsQueryResponse());
                    // Wait for rendering the logs
                    return [4 /*yield*/, screen.findByText(/custom log line/i)];
                case 1:
                    // Wait for rendering the logs
                    _a.sent();
                    return [4 /*yield*/, screen.findByText("loki Editor input: { label=\"value\"}")];
                case 2:
                    _a.sent();
                    datasources.elastic.query.mockReturnValueOnce(makeMetricsQueryResponse());
                    locationService.partial({
                        left: JSON.stringify(['now-1h', 'now', 'elastic', { expr: 'other query' }]),
                    });
                    // Editor renders the new query
                    return [4 /*yield*/, screen.findByText("elastic Editor input: other query")];
                case 3:
                    // Editor renders the new query
                    _a.sent();
                    // Renders graph
                    return [4 /*yield*/, screen.findByText(/Graph/i)];
                case 4:
                    // Renders graph
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it('handles changing the datasource manually', function () { return __awaiter(void 0, void 0, void 0, function () {
        var query, datasources;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    query = { left: JSON.stringify(['now-1h', 'now', 'loki', { expr: '{ label="value"}', refId: 'A' }]) };
                    datasources = setup({ query: query }).datasources;
                    datasources.loki.query.mockReturnValueOnce(makeLogsQueryResponse());
                    // Wait for rendering the editor
                    return [4 /*yield*/, screen.findByText(/Editor/i)];
                case 1:
                    // Wait for rendering the editor
                    _a.sent();
                    return [4 /*yield*/, changeDatasource('elastic')];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, screen.findByText('elastic Editor input:')];
                case 3:
                    _a.sent();
                    expect(datasources.elastic.query).not.toBeCalled();
                    expect(locationService.getSearchObject()).toEqual({
                        orgId: '1',
                        left: JSON.stringify(['now-1h', 'now', 'elastic', { refId: 'A' }]),
                    });
                    return [2 /*return*/];
            }
        });
    }); });
    it('opens the split pane when split button is clicked', function () { return __awaiter(void 0, void 0, void 0, function () {
        var splitButton;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    setup();
                    return [4 /*yield*/, screen.findByText(/split/i)];
                case 1:
                    splitButton = _a.sent();
                    fireEvent.click(splitButton);
                    return [4 /*yield*/, waitFor(function () {
                            var editors = screen.getAllByText('loki Editor input:');
                            expect(editors.length).toBe(2);
                        })];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it('inits with two panes if specified in url', function () { return __awaiter(void 0, void 0, void 0, function () {
        var query, datasources, logsLines;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    query = {
                        left: JSON.stringify(['now-1h', 'now', 'loki', { expr: '{ label="value"}', refId: 'A' }]),
                        right: JSON.stringify(['now-1h', 'now', 'elastic', { expr: 'error', refId: 'A' }]),
                    };
                    datasources = setup({ query: query }).datasources;
                    datasources.loki.query.mockReturnValueOnce(makeLogsQueryResponse());
                    datasources.elastic.query.mockReturnValueOnce(makeLogsQueryResponse());
                    // Make sure we render the logs panel
                    return [4 /*yield*/, waitFor(function () {
                            var logsPanels = screen.getAllByText(/^Logs$/);
                            expect(logsPanels.length).toBe(2);
                        })];
                case 1:
                    // Make sure we render the logs panel
                    _a.sent();
                    return [4 /*yield*/, screen.findAllByText(/custom log line/i)];
                case 2:
                    logsLines = _a.sent();
                    expect(logsLines.length).toBe(2);
                    // And that the editor gets the expr from the url
                    return [4 /*yield*/, screen.findByText("loki Editor input: { label=\"value\"}")];
                case 3:
                    // And that the editor gets the expr from the url
                    _a.sent();
                    return [4 /*yield*/, screen.findByText("elastic Editor input: error")];
                case 4:
                    _a.sent();
                    // We did not change the url
                    expect(locationService.getSearchObject()).toEqual(__assign({ orgId: '1' }, query));
                    // We called the data source query method once
                    expect(datasources.loki.query).toBeCalledTimes(1);
                    expect(datasources.loki.query.mock.calls[0][0]).toMatchObject({
                        targets: [{ expr: '{ label="value"}' }],
                    });
                    expect(datasources.elastic.query).toBeCalledTimes(1);
                    expect(datasources.elastic.query.mock.calls[0][0]).toMatchObject({
                        targets: [{ expr: 'error' }],
                    });
                    return [2 /*return*/];
            }
        });
    }); });
    it('can close a pane from a split', function () { return __awaiter(void 0, void 0, void 0, function () {
        var query, closeButtons;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    query = {
                        left: JSON.stringify(['now-1h', 'now', 'loki', { refId: 'A' }]),
                        right: JSON.stringify(['now-1h', 'now', 'elastic', { refId: 'A' }]),
                    };
                    setup({ query: query });
                    return [4 /*yield*/, screen.findAllByTitle(/Close split pane/i)];
                case 1:
                    closeButtons = _a.sent();
                    userEvent.click(closeButtons[1]);
                    return [4 /*yield*/, waitFor(function () {
                            var logsPanels = screen.queryAllByTitle(/Close split pane/i);
                            expect(logsPanels.length).toBe(0);
                        })];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it('handles url change to split view', function () { return __awaiter(void 0, void 0, void 0, function () {
        var query, datasources;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    query = {
                        left: JSON.stringify(['now-1h', 'now', 'loki', { expr: '{ label="value"}' }]),
                    };
                    datasources = setup({ query: query }).datasources;
                    datasources.loki.query.mockReturnValue(makeLogsQueryResponse());
                    datasources.elastic.query.mockReturnValue(makeLogsQueryResponse());
                    locationService.partial({
                        left: JSON.stringify(['now-1h', 'now', 'loki', { expr: '{ label="value"}' }]),
                        right: JSON.stringify(['now-1h', 'now', 'elastic', { expr: 'error' }]),
                    });
                    // Editor renders the new query
                    return [4 /*yield*/, screen.findByText("loki Editor input: { label=\"value\"}")];
                case 1:
                    // Editor renders the new query
                    _a.sent();
                    return [4 /*yield*/, screen.findByText("elastic Editor input: error")];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it('handles opening split with split open func', function () { return __awaiter(void 0, void 0, void 0, function () {
        var query, _a, datasources, store;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    query = {
                        left: JSON.stringify(['now-1h', 'now', 'loki', { expr: '{ label="value"}' }]),
                    };
                    _a = setup({ query: query }), datasources = _a.datasources, store = _a.store;
                    datasources.loki.query.mockReturnValue(makeLogsQueryResponse());
                    datasources.elastic.query.mockReturnValue(makeLogsQueryResponse());
                    // This is mainly to wait for render so that the left pane state is initialized as that is needed for splitOpen
                    // to work
                    return [4 /*yield*/, screen.findByText("loki Editor input: { label=\"value\"}")];
                case 1:
                    // This is mainly to wait for render so that the left pane state is initialized as that is needed for splitOpen
                    // to work
                    _b.sent();
                    store.dispatch(splitOpen({ datasourceUid: 'elastic', query: { expr: 'error' } }));
                    // Editor renders the new query
                    return [4 /*yield*/, screen.findByText("elastic Editor input: error")];
                case 2:
                    // Editor renders the new query
                    _b.sent();
                    return [4 /*yield*/, screen.findByText("loki Editor input: { label=\"value\"}")];
                case 3:
                    _b.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it('changes the document title of the explore page to include the datasource in use', function () { return __awaiter(void 0, void 0, void 0, function () {
        var query, datasources;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    query = {
                        left: JSON.stringify(['now-1h', 'now', 'loki', { expr: '{ label="value"}' }]),
                    };
                    datasources = setup({ query: query }).datasources;
                    datasources.loki.query.mockReturnValue(makeLogsQueryResponse());
                    // This is mainly to wait for render so that the left pane state is initialized as that is needed for the title
                    // to include the datasource
                    return [4 /*yield*/, screen.findByText("loki Editor input: { label=\"value\"}")];
                case 1:
                    // This is mainly to wait for render so that the left pane state is initialized as that is needed for the title
                    // to include the datasource
                    _a.sent();
                    return [4 /*yield*/, waitFor(function () { return expect(document.title).toEqual('Explore - loki - Grafana'); })];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it('changes the document title to include the two datasources in use in split view mode', function () { return __awaiter(void 0, void 0, void 0, function () {
        var query, _a, datasources, store;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    query = {
                        left: JSON.stringify(['now-1h', 'now', 'loki', { expr: '{ label="value"}' }]),
                    };
                    _a = setup({ query: query }), datasources = _a.datasources, store = _a.store;
                    datasources.loki.query.mockReturnValue(makeLogsQueryResponse());
                    datasources.elastic.query.mockReturnValue(makeLogsQueryResponse());
                    // This is mainly to wait for render so that the left pane state is initialized as that is needed for splitOpen
                    // to work
                    return [4 /*yield*/, screen.findByText("loki Editor input: { label=\"value\"}")];
                case 1:
                    // This is mainly to wait for render so that the left pane state is initialized as that is needed for splitOpen
                    // to work
                    _b.sent();
                    store.dispatch(splitOpen({ datasourceUid: 'elastic', query: { expr: 'error' } }));
                    return [4 /*yield*/, waitFor(function () { return expect(document.title).toEqual('Explore - loki | elastic - Grafana'); })];
                case 2:
                    _b.sent();
                    return [2 /*return*/];
            }
        });
    }); });
});
function setup(options) {
    // Clear this up otherwise it persists data source selection
    // TODO: probably add test for that too
    window.localStorage.clear();
    // Create this here so any mocks are recreated on setup and don't retain state
    var defaultDatasources = [
        makeDatasourceSetup(),
        makeDatasourceSetup({ name: 'elastic', id: 2 }),
    ];
    var dsSettings = (options === null || options === void 0 ? void 0 : options.datasources) || defaultDatasources;
    setDataSourceSrv({
        getList: function () {
            return dsSettings.map(function (d) { return d.settings; });
        },
        getInstanceSettings: function (name) {
            return dsSettings.map(function (d) { return d.settings; }).find(function (x) { return x.name === name || x.uid === name; });
        },
        get: function (name, scopedVars) {
            return Promise.resolve((name ? dsSettings.find(function (d) { return d.api.name === name || d.api.uid === name; }) : dsSettings[0]).api);
        },
    });
    setEchoSrv(new Echo());
    var store = configureStore();
    store.getState().user = __assign(__assign({}, initialUserState), { orgId: 1, timeZone: 'utc' });
    store.getState().navIndex = {
        explore: {
            id: 'explore',
            text: 'Explore',
            subTitle: 'Explore your data',
            icon: 'compass',
            url: '/explore',
        },
    };
    locationService.push({ pathname: '/explore' });
    if (options === null || options === void 0 ? void 0 : options.query) {
        locationService.partial(options.query);
    }
    var route = { component: Wrapper };
    render(React.createElement(Provider, { store: store },
        React.createElement(Router, { history: locationService.getHistory() },
            React.createElement(Route, { path: "/explore", exact: true, render: function (props) { return React.createElement(GrafanaRoute, __assign({}, props, { route: route })); } }))));
    return { datasources: fromPairs(dsSettings.map(function (d) { return [d.api.name, d.api]; })), store: store };
}
function makeDatasourceSetup(_a) {
    var _b = _a === void 0 ? {} : _a, _c = _b.name, name = _c === void 0 ? 'loki' : _c, _d = _b.id, id = _d === void 0 ? 1 : _d;
    var meta = {
        info: {
            logos: {
                small: '',
            },
        },
        id: id.toString(),
    };
    return {
        settings: {
            id: id,
            uid: name,
            type: 'logs',
            name: name,
            meta: meta,
            access: 'proxy',
            jsonData: {},
        },
        api: {
            components: {
                QueryEditor: function (props) {
                    return (React.createElement("div", null,
                        name,
                        " Editor input: ",
                        props.query.expr));
                },
            },
            name: name,
            uid: name,
            query: jest.fn(),
            getRef: jest.fn(),
            meta: meta,
        },
    };
}
function makeLogsQueryResponse(marker) {
    if (marker === void 0) { marker = ''; }
    var df = new ArrayDataFrame([{ ts: Date.now(), line: "custom log line " + marker }]);
    df.meta = {
        preferredVisualisationType: 'logs',
    };
    df.fields[0].type = FieldType.time;
    return from([{ data: [df] }]);
}
function makeMetricsQueryResponse() {
    var df = new ArrayDataFrame([{ ts: Date.now(), val: 1 }]);
    df.fields[0].type = FieldType.time;
    return from([{ data: [df] }]);
}
function changeDatasource(name) {
    return __awaiter(this, void 0, void 0, function () {
        var datasourcePicker, option;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, screen.findByLabelText(selectors.components.DataSourcePicker.container)];
                case 1:
                    datasourcePicker = (_a.sent()).children[0];
                    fireEvent.keyDown(datasourcePicker, { keyCode: 40 });
                    option = screen.getByText(name);
                    fireEvent.click(option);
                    return [2 /*return*/];
            }
        });
    });
}
//# sourceMappingURL=Wrapper.test.js.map