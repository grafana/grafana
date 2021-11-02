import { __awaiter, __extends, __generator, __makeTemplateObject, __read, __spreadArray } from "tslib";
// Libraries
import React, { PureComponent } from 'react';
import { AnnotationChangeEvent, AppEvents, dateTime, locationUtil, } from '@grafana/data';
import { config, getBackendSrv, locationService } from '@grafana/runtime';
import { AbstractList } from '@grafana/ui/src/components/List/AbstractList';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import appEvents from 'app/core/app_events';
import { AnnotationListItem } from './AnnotationListItem';
import { AnnotationListItemTags } from './AnnotationListItemTags';
import { CustomScrollbar, stylesFactory } from '@grafana/ui';
import { css } from '@emotion/css';
import { Subscription } from 'rxjs';
var AnnoListPanel = /** @class */ (function (_super) {
    __extends(AnnoListPanel, _super);
    function AnnoListPanel(props) {
        var _this = _super.call(this, props) || this;
        _this.style = getStyles(config.theme);
        _this.subs = new Subscription();
        _this.onAnnoClick = function (anno) {
            var _a;
            if (!anno.time) {
                return;
            }
            var options = _this.props.options;
            var dashboardSrv = getDashboardSrv();
            var current = dashboardSrv.getCurrent();
            var params = {
                from: _this._timeOffset(anno.time, options.navigateBefore, true),
                to: _this._timeOffset((_a = anno.timeEnd) !== null && _a !== void 0 ? _a : anno.time, options.navigateAfter, false),
            };
            if (options.navigateToPanel) {
                params.viewPanel = anno.panelId;
            }
            if ((current === null || current === void 0 ? void 0 : current.id) === anno.dashboardId) {
                locationService.partial(params);
                return;
            }
            getBackendSrv()
                .get('/api/search', { dashboardIds: anno.dashboardId })
                .then(function (res) {
                if (res && res.length && res[0].id === anno.dashboardId) {
                    var dash = res[0];
                    var newUrl = locationUtil.stripBaseFromUrl(dash.url);
                    locationService.push(newUrl);
                    return;
                }
                appEvents.emit(AppEvents.alertWarning, ['Unknown Dashboard: ' + anno.dashboardId]);
            });
        };
        _this.onTagClick = function (tag, remove) {
            var queryTags = remove ? _this.state.queryTags.filter(function (item) { return item !== tag; }) : __spreadArray(__spreadArray([], __read(_this.state.queryTags), false), [tag], false);
            _this.setState({ queryTags: queryTags });
        };
        _this.onUserClick = function (anno) {
            _this.setState({
                queryUser: {
                    id: anno.userId,
                    login: anno.login,
                    email: anno.email,
                },
            });
        };
        _this.onClearUser = function () {
            _this.setState({
                queryUser: undefined,
            });
        };
        _this.renderTags = function (tags, remove) {
            return React.createElement(AnnotationListItemTags, { tags: tags, remove: remove, onClick: _this.onTagClick });
        };
        _this.renderItem = function (anno, index) {
            var options = _this.props.options;
            var dashboard = getDashboardSrv().getCurrent();
            if (!dashboard) {
                return React.createElement(React.Fragment, null);
            }
            return (React.createElement(AnnotationListItem, { annotation: anno, formatDate: dashboard.formatDate, onClick: _this.onAnnoClick, onAvatarClick: _this.onUserClick, onTagClick: _this.onTagClick, options: options }));
        };
        _this.state = {
            annotations: [],
            timeInfo: '',
            loaded: false,
            queryTags: [],
        };
        return _this;
    }
    AnnoListPanel.prototype.componentDidMount = function () {
        var _this = this;
        this.doSearch();
        // When an annotation on this dashboard changes, re-run the query
        this.subs.add(this.props.eventBus.getStream(AnnotationChangeEvent).subscribe({
            next: function () {
                _this.doSearch();
            },
        }));
    };
    AnnoListPanel.prototype.componentWillUnmount = function () {
        this.subs.unsubscribe();
    };
    AnnoListPanel.prototype.componentDidUpdate = function (prevProps, prevState) {
        var _a = this.props, options = _a.options, timeRange = _a.timeRange;
        var needsQuery = options !== prevProps.options ||
            this.state.queryTags !== prevState.queryTags ||
            this.state.queryUser !== prevState.queryUser ||
            (options.onlyInTimeRange && timeRange !== prevProps.timeRange);
        if (needsQuery) {
            this.doSearch();
        }
    };
    AnnoListPanel.prototype.doSearch = function () {
        var _a;
        return __awaiter(this, void 0, void 0, function () {
            var options, _b, queryUser, queryTags, params, timeInfo, timeRange, annotations;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        options = this.props.options;
                        _b = this.state, queryUser = _b.queryUser, queryTags = _b.queryTags;
                        params = {
                            tags: options.tags,
                            limit: options.limit,
                            type: 'annotation', // Skip the Annotations that are really alerts.  (Use the alerts panel!)
                        };
                        if (options.onlyFromThisDashboard) {
                            params.dashboardId = (_a = getDashboardSrv().getCurrent()) === null || _a === void 0 ? void 0 : _a.id;
                        }
                        timeInfo = '';
                        if (options.onlyInTimeRange) {
                            timeRange = this.props.timeRange;
                            params.from = timeRange.from.valueOf();
                            params.to = timeRange.to.valueOf();
                        }
                        else {
                            timeInfo = 'All Time';
                        }
                        if (queryUser) {
                            params.userId = queryUser.id;
                        }
                        if (options.tags && options.tags.length) {
                            params.tags = options.tags;
                        }
                        if (queryTags.length) {
                            params.tags = params.tags ? __spreadArray(__spreadArray([], __read(params.tags), false), __read(queryTags), false) : queryTags;
                        }
                        return [4 /*yield*/, getBackendSrv().get('/api/annotations', params, "anno-list-panel-" + this.props.id)];
                    case 1:
                        annotations = _c.sent();
                        this.setState({
                            annotations: annotations,
                            timeInfo: timeInfo,
                            loaded: true,
                        });
                        return [2 /*return*/];
                }
            });
        });
    };
    AnnoListPanel.prototype._timeOffset = function (time, offset, subtract) {
        if (subtract === void 0) { subtract = false; }
        var incr = 5;
        var unit = 'm';
        var parts = /^(\d+)(\w)/.exec(offset);
        if (parts && parts.length === 3) {
            incr = parseInt(parts[1], 10);
            unit = parts[2];
        }
        var t = dateTime(time);
        if (subtract) {
            incr *= -1;
        }
        return t.add(incr, unit).valueOf();
    };
    AnnoListPanel.prototype.render = function () {
        var _a = this.state, loaded = _a.loaded, annotations = _a.annotations, queryUser = _a.queryUser, queryTags = _a.queryTags;
        if (!loaded) {
            return React.createElement("div", null, "loading...");
        }
        // Previously we showed inidication that it covered all time
        // { timeInfo && (
        //   <span className="panel-time-info">
        //     <Icon name="clock-nine" /> {timeInfo}
        //   </span>
        // )}
        var hasFilter = queryUser || queryTags.length > 0;
        return (React.createElement(CustomScrollbar, { autoHeightMin: "100%" },
            hasFilter && (React.createElement("div", null,
                React.createElement("b", null, "Filter: \u00A0 "),
                queryUser && (React.createElement("span", { onClick: this.onClearUser, className: "pointer" }, queryUser.email)),
                queryTags.length > 0 && this.renderTags(queryTags, true))),
            annotations.length < 1 && React.createElement("div", { className: this.style.noneFound }, "No Annotations Found"),
            React.createElement(AbstractList, { items: annotations, renderItem: this.renderItem, getItemKey: function (item) { return "" + item.id; } })));
    };
    return AnnoListPanel;
}(PureComponent));
export { AnnoListPanel };
var getStyles = stylesFactory(function (theme) { return ({
    noneFound: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    display: flex;\n    align-items: center;\n    justify-content: center;\n    width: 100%;\n    height: calc(100% - 30px);\n  "], ["\n    display: flex;\n    align-items: center;\n    justify-content: center;\n    width: 100%;\n    height: calc(100% - 30px);\n  "]))),
}); });
var templateObject_1;
//# sourceMappingURL=AnnoListPanel.js.map