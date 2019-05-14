import * as tslib_1 from "tslib";
// Libraries
import React from 'react';
import { hot } from 'react-hot-loader';
import { connect } from 'react-redux';
import { AutoSizer } from 'react-virtualized';
// Services & Utils
import store from 'app/core/store';
// Components
import { Alert } from './Error';
import ErrorBoundary from './ErrorBoundary';
import GraphContainer from './GraphContainer';
import LogsContainer from './LogsContainer';
import QueryRows from './QueryRows';
import TableContainer from './TableContainer';
import { parseTime } from './TimePicker';
// Actions
import { changeSize, changeTime, initializeExplore, modifyQueries, scanStart, setQueries } from './state/actions';
import { LAST_USED_DATASOURCE_KEY, ensureQueries, DEFAULT_RANGE, DEFAULT_UI_STATE } from 'app/core/utils/explore';
import { Emitter } from 'app/core/utils/emitter';
import { ExploreToolbar } from './ExploreToolbar';
import { scanStopAction } from './state/actionTypes';
/**
 * Explore provides an area for quick query iteration for a given datasource.
 * Once a datasource is selected it populates the query section at the top.
 * When queries are run, their results are being displayed in the main section.
 * The datasource determines what kind of query editor it brings, and what kind
 * of results viewers it supports. The state is managed entirely in Redux.
 *
 * SPLIT VIEW
 *
 * Explore can have two Explore areas side-by-side. This is handled in `Wrapper.tsx`.
 * Since there can be multiple Explores (e.g., left and right) each action needs
 * the `exploreId` as first parameter so that the reducer knows which Explore state
 * is affected.
 *
 * DATASOURCE REQUESTS
 *
 * A click on Run Query creates transactions for all DataQueries for all expanded
 * result viewers. New runs are discarding previous runs. Upon completion a transaction
 * saves the result. The result viewers construct their data from the currently existing
 * transactions.
 *
 * The result viewers determine some of the query options sent to the datasource, e.g.,
 * `format`, to indicate eventual transformations by the datasources' result transformers.
 */
var Explore = /** @class */ (function (_super) {
    tslib_1.__extends(Explore, _super);
    function Explore(props) {
        var _this = _super.call(this, props) || this;
        _this.getRef = function (el) {
            _this.el = el;
        };
        _this.onChangeTime = function (range, changedByScanner) {
            if (_this.props.scanning && !changedByScanner) {
                _this.onStopScanning();
            }
            _this.props.changeTime(_this.props.exploreId, range);
        };
        // Use this in help pages to set page to a single query
        _this.onClickExample = function (query) {
            _this.props.setQueries(_this.props.exploreId, [query]);
        };
        _this.onClickLabel = function (key, value) {
            _this.onModifyQueries({ type: 'ADD_FILTER', key: key, value: value });
        };
        _this.onModifyQueries = function (action, index) {
            var datasourceInstance = _this.props.datasourceInstance;
            if (datasourceInstance && datasourceInstance.modifyQuery) {
                var modifier = function (queries, modification) { return datasourceInstance.modifyQuery(queries, modification); };
                _this.props.modifyQueries(_this.props.exploreId, action, index, modifier);
            }
        };
        _this.onResize = function (size) {
            _this.props.changeSize(_this.props.exploreId, size);
        };
        _this.onStartScanning = function () {
            // Scanner will trigger a query
            var scanner = _this.scanPreviousRange;
            _this.props.scanStart(_this.props.exploreId, scanner);
        };
        _this.scanPreviousRange = function () {
            // Calling move() on the timepicker will trigger this.onChangeTime()
            return _this.timepickerRef.current.move(-1, true);
        };
        _this.onStopScanning = function () {
            _this.props.scanStopAction({ exploreId: _this.props.exploreId });
        };
        _this.exploreEvents = new Emitter();
        _this.timepickerRef = React.createRef();
        return _this;
    }
    Explore.prototype.componentDidMount = function () {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var _a, exploreId, initialized, urlState, _b, datasource, queries, _c, range, _d, ui, initialDatasource, initialQueries, initialRange, width;
            return tslib_1.__generator(this, function (_e) {
                _a = this.props, exploreId = _a.exploreId, initialized = _a.initialized, urlState = _a.urlState;
                // Don't initialize on split, but need to initialize urlparameters when present
                if (!initialized) {
                    _b = (urlState || {}), datasource = _b.datasource, queries = _b.queries, _c = _b.range, range = _c === void 0 ? DEFAULT_RANGE : _c, _d = _b.ui, ui = _d === void 0 ? DEFAULT_UI_STATE : _d;
                    initialDatasource = datasource || store.get(LAST_USED_DATASOURCE_KEY);
                    initialQueries = ensureQueries(queries);
                    initialRange = { from: parseTime(range.from), to: parseTime(range.to) };
                    width = this.el ? this.el.offsetWidth : 0;
                    this.props.initializeExplore(exploreId, initialDatasource, initialQueries, initialRange, width, this.exploreEvents, ui);
                }
                return [2 /*return*/];
            });
        });
    };
    Explore.prototype.componentWillUnmount = function () {
        this.exploreEvents.removeAllListeners();
    };
    Explore.prototype.render = function () {
        var _this = this;
        var _a = this.props, StartPage = _a.StartPage, datasourceInstance = _a.datasourceInstance, datasourceError = _a.datasourceError, datasourceLoading = _a.datasourceLoading, datasourceMissing = _a.datasourceMissing, exploreId = _a.exploreId, showingStartPage = _a.showingStartPage, split = _a.split, supportsGraph = _a.supportsGraph, supportsLogs = _a.supportsLogs, supportsTable = _a.supportsTable, queryKeys = _a.queryKeys;
        var exploreClass = split ? 'explore explore-split' : 'explore';
        return (React.createElement("div", { className: exploreClass, ref: this.getRef },
            React.createElement(ExploreToolbar, { exploreId: exploreId, timepickerRef: this.timepickerRef, onChangeTime: this.onChangeTime }),
            datasourceLoading ? React.createElement("div", { className: "explore-container" }, "Loading datasource...") : null,
            datasourceMissing ? (React.createElement("div", { className: "explore-container" }, "Please add a datasource that supports Explore (e.g., Prometheus).")) : null,
            datasourceError && (React.createElement("div", { className: "explore-container" },
                React.createElement(Alert, { message: "Error connecting to datasource: " + datasourceError }))),
            datasourceInstance && !datasourceError && (React.createElement("div", { className: "explore-container" },
                React.createElement(QueryRows, { exploreEvents: this.exploreEvents, exploreId: exploreId, queryKeys: queryKeys }),
                React.createElement(AutoSizer, { onResize: this.onResize, disableHeight: true }, function (_a) {
                    var width = _a.width;
                    if (width === 0) {
                        return null;
                    }
                    return (React.createElement("main", { className: "m-t-2", style: { width: width } },
                        React.createElement(ErrorBoundary, null,
                            showingStartPage && React.createElement(StartPage, { onClickExample: _this.onClickExample }),
                            !showingStartPage && (React.createElement(React.Fragment, null,
                                supportsGraph && !supportsLogs && React.createElement(GraphContainer, { width: width, exploreId: exploreId }),
                                supportsTable && React.createElement(TableContainer, { exploreId: exploreId, onClickCell: _this.onClickLabel }),
                                supportsLogs && (React.createElement(LogsContainer, { width: width, exploreId: exploreId, onChangeTime: _this.onChangeTime, onClickLabel: _this.onClickLabel, onStartScanning: _this.onStartScanning, onStopScanning: _this.onStopScanning })))))));
                })))));
    };
    return Explore;
}(React.PureComponent));
export { Explore };
function mapStateToProps(state, _a) {
    var exploreId = _a.exploreId;
    var explore = state.explore;
    var split = explore.split;
    var item = explore[exploreId];
    var StartPage = item.StartPage, datasourceError = item.datasourceError, datasourceInstance = item.datasourceInstance, datasourceLoading = item.datasourceLoading, datasourceMissing = item.datasourceMissing, initialized = item.initialized, range = item.range, showingStartPage = item.showingStartPage, supportsGraph = item.supportsGraph, supportsLogs = item.supportsLogs, supportsTable = item.supportsTable, queryKeys = item.queryKeys;
    return {
        StartPage: StartPage,
        datasourceError: datasourceError,
        datasourceInstance: datasourceInstance,
        datasourceLoading: datasourceLoading,
        datasourceMissing: datasourceMissing,
        initialized: initialized,
        range: range,
        showingStartPage: showingStartPage,
        split: split,
        supportsGraph: supportsGraph,
        supportsLogs: supportsLogs,
        supportsTable: supportsTable,
        queryKeys: queryKeys,
    };
}
var mapDispatchToProps = {
    changeSize: changeSize,
    changeTime: changeTime,
    initializeExplore: initializeExplore,
    modifyQueries: modifyQueries,
    scanStart: scanStart,
    scanStopAction: scanStopAction,
    setQueries: setQueries,
};
export default hot(module)(connect(mapStateToProps, mapDispatchToProps)(Explore));
//# sourceMappingURL=Explore.js.map