import * as tslib_1 from "tslib";
import React, { PureComponent } from 'react';
import { JSONFormatter } from 'app/core/components/JSONFormatter/JSONFormatter';
import appEvents from 'app/core/app_events';
import { CopyToClipboard } from 'app/core/components/CopyToClipboard/CopyToClipboard';
import { LoadingPlaceholder } from '@grafana/ui';
var QueryInspector = /** @class */ (function (_super) {
    tslib_1.__extends(QueryInspector, _super);
    function QueryInspector(props) {
        var _this = _super.call(this, props) || this;
        _this.onPanelRefresh = function () {
            _this.setState(function (prevState) { return (tslib_1.__assign({}, prevState, { dsQuery: {
                    isLoading: true,
                    response: {},
                } })); });
        };
        _this.onDataSourceResponse = function (response) {
            if (response === void 0) { response = {}; }
            if (_this.state.isMocking) {
                _this.handleMocking(response);
                return;
            }
            response = tslib_1.__assign({}, response); // clone - dont modify the response
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
                delete response.data;
                delete response.status;
                delete response.statusText;
                delete response.$$config;
            }
            _this.setState(function (prevState) { return (tslib_1.__assign({}, prevState, { dsQuery: {
                    isLoading: false,
                    response: response,
                } })); });
        };
        _this.setFormattedJson = function (formattedJson) {
            _this.formattedJson = formattedJson;
        };
        _this.getTextForClipboard = function () {
            return JSON.stringify(_this.formattedJson, null, 2);
        };
        _this.onClipboardSuccess = function () {
            appEvents.emit('alert-success', ['Content copied to clipboard']);
        };
        _this.onToggleExpand = function () {
            _this.setState(function (prevState) { return (tslib_1.__assign({}, prevState, { allNodesExpanded: !_this.state.allNodesExpanded })); });
        };
        _this.onToggleMocking = function () {
            _this.setState(function (prevState) { return (tslib_1.__assign({}, prevState, { isMocking: !_this.state.isMocking })); });
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
            _this.setState(function (prevState) { return (tslib_1.__assign({}, prevState, { mockedResponse: mockedResponse })); });
        };
        _this.renderExpandCollapse = function () {
            var allNodesExpanded = _this.state.allNodesExpanded;
            var collapse = (React.createElement(React.Fragment, null,
                React.createElement("i", { className: "fa fa-minus-square-o" }),
                " Collapse All"));
            var expand = (React.createElement(React.Fragment, null,
                React.createElement("i", { className: "fa fa-plus-square-o" }),
                " Expand All"));
            return allNodesExpanded ? collapse : expand;
        };
        _this.state = {
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
        var panel = this.props.panel;
        panel.events.on('refresh', this.onPanelRefresh);
        appEvents.on('ds-request-response', this.onDataSourceResponse);
        panel.refresh();
    };
    QueryInspector.prototype.componentWillUnmount = function () {
        var panel = this.props.panel;
        appEvents.off('ds-request-response', this.onDataSourceResponse);
        panel.events.off('refresh', this.onPanelRefresh);
    };
    QueryInspector.prototype.handleMocking = function (response) {
        var mockedResponse = this.state.mockedResponse;
        var mockedData;
        try {
            mockedData = JSON.parse(mockedResponse);
        }
        catch (err) {
            appEvents.emit('alert-error', ['R: Failed to parse mocked response']);
            return;
        }
        response.data = mockedData;
    };
    QueryInspector.prototype.render = function () {
        var _a = this.state.dsQuery, response = _a.response, isLoading = _a.isLoading;
        var openNodes = this.getNrOfOpenNodes();
        if (isLoading) {
            return React.createElement(LoadingPlaceholder, { text: "Loading query inspector..." });
        }
        return (React.createElement(React.Fragment, null,
            React.createElement("div", { className: "pull-right" },
                React.createElement("button", { className: "btn btn-transparent btn-p-x-0 m-r-1", onClick: this.onToggleExpand }, this.renderExpandCollapse()),
                React.createElement(CopyToClipboard, { className: "btn btn-transparent btn-p-x-0", text: this.getTextForClipboard, onSuccess: this.onClipboardSuccess },
                    React.createElement("i", { className: "fa fa-clipboard" }),
                    " Copy to Clipboard")),
            React.createElement(JSONFormatter, { json: response, open: openNodes, onDidRender: this.setFormattedJson })));
    };
    return QueryInspector;
}(PureComponent));
export { QueryInspector };
//# sourceMappingURL=QueryInspector.js.map