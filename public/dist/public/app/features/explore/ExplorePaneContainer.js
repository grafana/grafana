import { __extends } from "tslib";
import React from 'react';
import { connect } from 'react-redux';
import memoizeOne from 'memoize-one';
import { EventBusSrv } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import store from 'app/core/store';
import { lastSavedUrl, cleanupPaneAction } from './state/main';
import { initializeExplore, refreshExplore } from './state/explorePane';
import { DEFAULT_RANGE, ensureQueries, getTimeRange, getTimeRangeFromUrl, lastUsedDatasourceKeyForOrgId, parseUrlState, } from 'app/core/utils/explore';
import { getFiscalYearStartMonth, getTimeZone } from '../profile/state/selectors';
import Explore from './Explore';
/**
 * This component is responsible for handling initialization of an Explore pane and triggering synchronization
 * of state based on URL changes and preventing any infinite loops.
 */
var ExplorePaneContainerUnconnected = /** @class */ (function (_super) {
    __extends(ExplorePaneContainerUnconnected, _super);
    function ExplorePaneContainerUnconnected(props) {
        var _this = _super.call(this, props) || this;
        _this.refreshExplore = function (prevUrlQuery) {
            var _a = _this.props, exploreId = _a.exploreId, urlQuery = _a.urlQuery;
            // Update state from url only if it changed and only if the change wasn't initialised by redux to prevent any loops
            if (urlQuery !== prevUrlQuery && urlQuery !== lastSavedUrl[exploreId]) {
                _this.props.refreshExplore(exploreId, urlQuery);
            }
        };
        _this.getRef = function (el) {
            _this.el = el;
        };
        _this.exploreEvents = new EventBusSrv();
        _this.state = {
            openDrawer: undefined,
        };
        return _this;
    }
    ExplorePaneContainerUnconnected.prototype.componentDidMount = function () {
        var _a, _b;
        var _c = this.props, initialized = _c.initialized, exploreId = _c.exploreId, initialDatasource = _c.initialDatasource, initialQueries = _c.initialQueries, initialRange = _c.initialRange, originPanelId = _c.originPanelId;
        var width = (_b = (_a = this.el) === null || _a === void 0 ? void 0 : _a.offsetWidth) !== null && _b !== void 0 ? _b : 0;
        // initialize the whole explore first time we mount and if browser history contains a change in datasource
        if (!initialized) {
            this.props.initializeExplore(exploreId, initialDatasource, initialQueries, initialRange, width, this.exploreEvents, originPanelId);
        }
    };
    ExplorePaneContainerUnconnected.prototype.componentWillUnmount = function () {
        this.exploreEvents.removeAllListeners();
        this.props.cleanupPaneAction({ exploreId: this.props.exploreId });
    };
    ExplorePaneContainerUnconnected.prototype.componentDidUpdate = function (prevProps) {
        this.refreshExplore(prevProps.urlQuery);
    };
    ExplorePaneContainerUnconnected.prototype.render = function () {
        var exploreClass = this.props.split ? 'explore explore-split' : 'explore';
        return (React.createElement("div", { className: exploreClass, ref: this.getRef, "data-testid": selectors.pages.Explore.General.container }, this.props.initialized && React.createElement(Explore, { exploreId: this.props.exploreId })));
    };
    return ExplorePaneContainerUnconnected;
}(React.PureComponent));
var ensureQueriesMemoized = memoizeOne(ensureQueries);
var getTimeRangeFromUrlMemoized = memoizeOne(getTimeRangeFromUrl);
function mapStateToProps(state, props) {
    var _a;
    var urlState = parseUrlState(props.urlQuery);
    var timeZone = getTimeZone(state.user);
    var fiscalYearStartMonth = getFiscalYearStartMonth(state.user);
    var _b = (urlState || {}), datasource = _b.datasource, queries = _b.queries, urlRange = _b.range, originPanelId = _b.originPanelId;
    var initialDatasource = datasource || store.get(lastUsedDatasourceKeyForOrgId(state.user.orgId));
    var initialQueries = ensureQueriesMemoized(queries);
    var initialRange = urlRange
        ? getTimeRangeFromUrlMemoized(urlRange, timeZone, fiscalYearStartMonth)
        : getTimeRange(timeZone, DEFAULT_RANGE, fiscalYearStartMonth);
    return {
        initialized: (_a = state.explore[props.exploreId]) === null || _a === void 0 ? void 0 : _a.initialized,
        initialDatasource: initialDatasource,
        initialQueries: initialQueries,
        initialRange: initialRange,
        originPanelId: originPanelId,
    };
}
var mapDispatchToProps = {
    initializeExplore: initializeExplore,
    refreshExplore: refreshExplore,
    cleanupPaneAction: cleanupPaneAction,
};
var connector = connect(mapStateToProps, mapDispatchToProps);
export var ExplorePaneContainer = connector(ExplorePaneContainerUnconnected);
//# sourceMappingURL=ExplorePaneContainer.js.map