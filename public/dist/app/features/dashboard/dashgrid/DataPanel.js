import * as tslib_1 from "tslib";
// Library
import React, { Component } from 'react';
// Services
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
// Utils
import kbn from 'app/core/utils/kbn';
// Types
import { LoadingState, } from '@grafana/ui';
var DataPanel = /** @class */ (function (_super) {
    tslib_1.__extends(DataPanel, _super);
    function DataPanel(props) {
        var _this = _super.call(this, props) || this;
        _this.dataSourceSrv = getDatasourceSrv();
        _this.isUnmounted = false;
        _this.issueQueries = function () { return tslib_1.__awaiter(_this, void 0, void 0, function () {
            var _a, isVisible, queries, datasource, panelId, dashboardId, timeRange, widthPixels, maxDataPoints, scopedVars, onDataResponse, onError, ds, minInterval, intervalRes, queryOptions, resp, err_1, message;
            return tslib_1.__generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = this.props, isVisible = _a.isVisible, queries = _a.queries, datasource = _a.datasource, panelId = _a.panelId, dashboardId = _a.dashboardId, timeRange = _a.timeRange, widthPixels = _a.widthPixels, maxDataPoints = _a.maxDataPoints, scopedVars = _a.scopedVars, onDataResponse = _a.onDataResponse, onError = _a.onError;
                        if (!isVisible) {
                            return [2 /*return*/];
                        }
                        if (!queries.length) {
                            this.setState({ loading: LoadingState.Done });
                            return [2 /*return*/];
                        }
                        this.setState({ loading: LoadingState.Loading });
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 4, , 5]);
                        return [4 /*yield*/, this.dataSourceSrv.get(datasource, scopedVars)];
                    case 2:
                        ds = _b.sent();
                        minInterval = this.props.minInterval || ds.interval;
                        intervalRes = kbn.calculateInterval(timeRange, widthPixels, minInterval);
                        queryOptions = {
                            timezone: 'browser',
                            panelId: panelId,
                            dashboardId: dashboardId,
                            range: timeRange,
                            rangeRaw: timeRange.raw,
                            interval: intervalRes.interval,
                            intervalMs: intervalRes.intervalMs,
                            targets: queries,
                            maxDataPoints: maxDataPoints || widthPixels,
                            scopedVars: scopedVars || {},
                            cacheTimeout: null,
                        };
                        return [4 /*yield*/, ds.query(queryOptions)];
                    case 3:
                        resp = _b.sent();
                        if (this.isUnmounted) {
                            return [2 /*return*/];
                        }
                        if (onDataResponse) {
                            onDataResponse(resp);
                        }
                        this.setState({
                            loading: LoadingState.Done,
                            response: resp,
                            panelData: this.getPanelData(resp),
                            isFirstLoad: false,
                        });
                        return [3 /*break*/, 5];
                    case 4:
                        err_1 = _b.sent();
                        console.log('DataPanel error', err_1);
                        message = 'Query error';
                        if (err_1.message) {
                            message = err_1.message;
                        }
                        else if (err_1.data && err_1.data.message) {
                            message = err_1.data.message;
                        }
                        else if (err_1.data && err_1.data.error) {
                            message = err_1.data.error;
                        }
                        else if (err_1.status) {
                            message = "Query error: " + err_1.status + " " + err_1.statusText;
                        }
                        onError(message, err_1);
                        this.setState({ isFirstLoad: false, loading: LoadingState.Error });
                        return [3 /*break*/, 5];
                    case 5: return [2 /*return*/];
                }
            });
        }); };
        _this.state = {
            loading: LoadingState.NotStarted,
            response: {
                data: [],
            },
            panelData: {},
            isFirstLoad: true,
        };
        return _this;
    }
    DataPanel.prototype.componentDidMount = function () {
        this.issueQueries();
    };
    DataPanel.prototype.componentWillUnmount = function () {
        this.isUnmounted = true;
    };
    DataPanel.prototype.componentDidUpdate = function (prevProps) {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            return tslib_1.__generator(this, function (_a) {
                if (!this.hasPropsChanged(prevProps)) {
                    return [2 /*return*/];
                }
                this.issueQueries();
                return [2 /*return*/];
            });
        });
    };
    DataPanel.prototype.hasPropsChanged = function (prevProps) {
        return this.props.refreshCounter !== prevProps.refreshCounter;
    };
    DataPanel.prototype.getPanelData = function (response) {
        if (response.data.length > 0 && response.data[0].type === 'table') {
            return {
                tableData: response.data[0],
                timeSeries: null,
            };
        }
        return {
            timeSeries: response.data,
            tableData: null,
        };
    };
    DataPanel.prototype.render = function () {
        var queries = this.props.queries;
        var _a = this.state, loading = _a.loading, isFirstLoad = _a.isFirstLoad, panelData = _a.panelData;
        // do not render component until we have first data
        if (isFirstLoad && (loading === LoadingState.Loading || loading === LoadingState.NotStarted)) {
            return this.renderLoadingState();
        }
        if (!queries.length) {
            return (React.createElement("div", { className: "panel-empty" },
                React.createElement("p", null, "Add a query to get some data!")));
        }
        return (React.createElement(React.Fragment, null,
            loading === LoadingState.Loading && this.renderLoadingState(),
            this.props.children({ loading: loading, panelData: panelData })));
    };
    DataPanel.prototype.renderLoadingState = function () {
        return (React.createElement("div", { className: "panel-loading" },
            React.createElement("i", { className: "fa fa-spinner fa-spin" })));
    };
    DataPanel.defaultProps = {
        isVisible: true,
        dashboardId: 1,
    };
    return DataPanel;
}(Component));
export { DataPanel };
//# sourceMappingURL=DataPanel.js.map