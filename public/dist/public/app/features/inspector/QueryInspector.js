import { __assign, __extends, __makeTemplateObject } from "tslib";
import React, { PureComponent } from 'react';
import { Button, JSONFormatter, LoadingPlaceholder } from '@grafana/ui';
import { selectors } from '@grafana/e2e-selectors';
import { AppEvents } from '@grafana/data';
import appEvents from 'app/core/app_events';
import { CopyToClipboard } from 'app/core/components/CopyToClipboard/CopyToClipboard';
import { getPanelInspectorStyles } from './styles';
import { supportsDataQuery } from 'app/features/dashboard/components/PanelEditor/utils';
import { config, RefreshEvent } from '@grafana/runtime';
import { css } from '@emotion/css';
import { Subscription } from 'rxjs';
import { backendSrv } from 'app/core/services/backend_srv';
var QueryInspector = /** @class */ (function (_super) {
    __extends(QueryInspector, _super);
    function QueryInspector(props) {
        var _this = _super.call(this, props) || this;
        _this.subs = new Subscription();
        _this.onPanelRefresh = function () {
            _this.setState(function (prevState) { return (__assign(__assign({}, prevState), { dsQuery: {
                    isLoading: true,
                    response: {},
                } })); });
        };
        _this.setFormattedJson = function (formattedJson) {
            _this.formattedJson = formattedJson;
        };
        _this.getTextForClipboard = function () {
            return JSON.stringify(_this.formattedJson, null, 2);
        };
        _this.onClipboardSuccess = function () {
            appEvents.emit(AppEvents.alertSuccess, ['Content copied to clipboard']);
        };
        _this.onToggleExpand = function () {
            _this.setState(function (prevState) { return (__assign(__assign({}, prevState), { allNodesExpanded: !_this.state.allNodesExpanded })); });
        };
        _this.onToggleMocking = function () {
            _this.setState(function (prevState) { return (__assign(__assign({}, prevState), { isMocking: !_this.state.isMocking })); });
        };
        _this.getNrOfOpenNodes = function () {
            if (_this.state.allNodesExpanded === null) {
                return 3; // 3 is default, ie when state is null
            }
            else if (_this.state.allNodesExpanded) {
                return 20;
            }
            return 1;
        };
        _this.setMockedResponse = function (evt) {
            var mockedResponse = evt.target.value;
            _this.setState(function (prevState) { return (__assign(__assign({}, prevState), { mockedResponse: mockedResponse })); });
        };
        _this.state = {
            executedQueries: [],
            allNodesExpanded: null,
            isMocking: false,
            mockedResponse: '',
            dsQuery: {
                isLoading: false,
                response: {},
            },
        };
        return _this;
    }
    QueryInspector.prototype.componentDidMount = function () {
        var _this = this;
        var panel = this.props.panel;
        this.subs.add(backendSrv.getInspectorStream().subscribe({
            next: function (response) { return _this.onDataSourceResponse(response); },
        }));
        if (panel) {
            this.subs.add(panel.events.subscribe(RefreshEvent, this.onPanelRefresh));
            this.updateQueryList();
        }
    };
    QueryInspector.prototype.componentDidUpdate = function (oldProps) {
        if (this.props.data !== oldProps.data) {
            this.updateQueryList();
        }
    };
    /**
     * Find the list of executed queries
     */
    QueryInspector.prototype.updateQueryList = function () {
        var data = this.props.data;
        var executedQueries = [];
        if (data === null || data === void 0 ? void 0 : data.length) {
            var last_1 = undefined;
            data.forEach(function (frame, idx) {
                var _a;
                var query = (_a = frame.meta) === null || _a === void 0 ? void 0 : _a.executedQueryString;
                if (query) {
                    var refId = frame.refId || '?';
                    if ((last_1 === null || last_1 === void 0 ? void 0 : last_1.refId) === refId) {
                        last_1.frames++;
                        last_1.rows += frame.length;
                    }
                    else {
                        last_1 = {
                            refId: refId,
                            frames: 0,
                            rows: frame.length,
                            query: query,
                        };
                        executedQueries.push(last_1);
                    }
                }
            });
        }
        this.setState({ executedQueries: executedQueries });
    };
    QueryInspector.prototype.componentWillUnmount = function () {
        this.subs.unsubscribe();
    };
    QueryInspector.prototype.onDataSourceResponse = function (response) {
        var _a;
        // ignore silent requests
        if ((_a = response.config) === null || _a === void 0 ? void 0 : _a.hideFromInspector) {
            return;
        }
        response = __assign({}, response); // clone - dont modify the response
        if (response.headers) {
            delete response.headers;
        }
        if (response.config) {
            response.request = response.config;
            delete response.config;
            delete response.request.transformRequest;
            delete response.request.transformResponse;
            delete response.request.paramSerializer;
            delete response.request.jsonpCallbackParam;
            delete response.request.headers;
            delete response.request.requestId;
            delete response.request.inspect;
            delete response.request.retry;
            delete response.request.timeout;
        }
        if (response.data) {
            response.response = response.data;
            delete response.config;
            delete response.data;
            delete response.status;
            delete response.statusText;
            delete response.ok;
            delete response.url;
            delete response.redirected;
            delete response.type;
            delete response.$$config;
        }
        this.setState(function (prevState) { return (__assign(__assign({}, prevState), { dsQuery: {
                isLoading: false,
                response: response,
            } })); });
    };
    QueryInspector.prototype.renderExecutedQueries = function (executedQueries) {
        if (!executedQueries.length) {
            return null;
        }
        var styles = {
            refId: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n        font-weight: ", ";\n        color: ", ";\n        margin-right: 8px;\n      "], ["\n        font-weight: ", ";\n        color: ", ";\n        margin-right: 8px;\n      "])), config.theme.typography.weight.semibold, config.theme.colors.textBlue),
        };
        return (React.createElement("div", null, executedQueries.map(function (info) {
            return (React.createElement("div", { key: info.refId },
                React.createElement("div", null,
                    React.createElement("span", { className: styles.refId },
                        info.refId,
                        ":"),
                    info.frames > 1 && React.createElement("span", null,
                        info.frames,
                        " frames, "),
                    React.createElement("span", null,
                        info.rows,
                        " rows")),
                React.createElement("pre", null, info.query)));
        })));
    };
    QueryInspector.prototype.render = function () {
        var _a = this.state, allNodesExpanded = _a.allNodesExpanded, executedQueries = _a.executedQueries;
        var _b = this.props, panel = _b.panel, onRefreshQuery = _b.onRefreshQuery;
        var _c = this.state.dsQuery, response = _c.response, isLoading = _c.isLoading;
        var openNodes = this.getNrOfOpenNodes();
        var styles = getPanelInspectorStyles();
        var haveData = Object.keys(response).length > 0;
        if (panel && !supportsDataQuery(panel.plugin)) {
            return null;
        }
        return (React.createElement(React.Fragment, null,
            React.createElement("div", { "aria-label": selectors.components.PanelInspector.Query.content },
                React.createElement("h3", { className: "section-heading" }, "Query inspector"),
                React.createElement("p", { className: "small muted" }, "Query inspector allows you to view raw request and response. To collect this data Grafana needs to issue a new query. Click refresh button below to trigger a new query.")),
            this.renderExecutedQueries(executedQueries),
            React.createElement("div", { className: styles.toolbar },
                React.createElement(Button, { icon: "sync", onClick: onRefreshQuery, "aria-label": selectors.components.PanelInspector.Query.refreshButton }, "Refresh"),
                haveData && allNodesExpanded && (React.createElement(Button, { icon: "minus", variant: "secondary", className: styles.toolbarItem, onClick: this.onToggleExpand }, "Collapse all")),
                haveData && !allNodesExpanded && (React.createElement(Button, { icon: "plus", variant: "secondary", className: styles.toolbarItem, onClick: this.onToggleExpand }, "Expand all")),
                haveData && (React.createElement(CopyToClipboard, { text: this.getTextForClipboard, onSuccess: this.onClipboardSuccess, elType: "div", className: styles.toolbarItem },
                    React.createElement(Button, { icon: "copy", variant: "secondary" }, "Copy to clipboard"))),
                React.createElement("div", { className: "flex-grow-1" })),
            React.createElement("div", { className: styles.contentQueryInspector },
                isLoading && React.createElement(LoadingPlaceholder, { text: "Loading query inspector..." }),
                !isLoading && haveData && (React.createElement(JSONFormatter, { json: response, open: openNodes, onDidRender: this.setFormattedJson })),
                !isLoading && !haveData && (React.createElement("p", { className: "muted" }, "No request and response collected yet. Hit refresh button")))));
    };
    return QueryInspector;
}(PureComponent));
export { QueryInspector };
var templateObject_1;
//# sourceMappingURL=QueryInspector.js.map