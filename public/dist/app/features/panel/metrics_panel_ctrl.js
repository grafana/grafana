import * as tslib_1 from "tslib";
import _ from 'lodash';
import kbn from 'app/core/utils/kbn';
import { PanelCtrl } from 'app/features/panel/panel_ctrl';
import { getExploreUrl } from 'app/core/utils/explore';
import { applyPanelTimeOverrides, getResolution } from 'app/features/dashboard/utils/panel';
var MetricsPanelCtrl = /** @class */ (function (_super) {
    tslib_1.__extends(MetricsPanelCtrl, _super);
    function MetricsPanelCtrl($scope, $injector) {
        var _this = _super.call(this, $scope, $injector) || this;
        _this.$q = $injector.get('$q');
        _this.contextSrv = $injector.get('contextSrv');
        _this.datasourceSrv = $injector.get('datasourceSrv');
        _this.timeSrv = $injector.get('timeSrv');
        _this.templateSrv = $injector.get('templateSrv');
        _this.scope = $scope;
        _this.panel.datasource = _this.panel.datasource || null;
        _this.events.on('refresh', _this.onMetricsPanelRefresh.bind(_this));
        _this.events.on('panel-teardown', _this.onPanelTearDown.bind(_this));
        return _this;
    }
    MetricsPanelCtrl.prototype.onPanelTearDown = function () {
        if (this.dataSubscription) {
            this.dataSubscription.unsubscribe();
            this.dataSubscription = null;
        }
    };
    MetricsPanelCtrl.prototype.onMetricsPanelRefresh = function () {
        var _this = this;
        // ignore fetching data if another panel is in fullscreen
        if (this.otherPanelInFullscreenMode()) {
            return;
        }
        // if we have snapshot data use that
        if (this.panel.snapshotData) {
            this.updateTimeRange();
            var data_1 = this.panel.snapshotData;
            // backward compatibility
            if (!_.isArray(data_1)) {
                data_1 = data_1.data;
            }
            // Defer panel rendering till the next digest cycle.
            // For some reason snapshot panels don't init at this time, so this helps to avoid rendering issues.
            return this.$timeout(function () {
                _this.events.emit('data-snapshot-load', data_1);
            });
        }
        // // ignore if we have data stream
        if (this.dataStream) {
            return;
        }
        // clear loading/error state
        delete this.error;
        this.loading = true;
        // load datasource service
        this.datasourceSrv
            .get(this.panel.datasource, this.panel.scopedVars)
            .then(this.updateTimeRange.bind(this))
            .then(this.issueQueries.bind(this))
            .then(this.handleQueryResult.bind(this))
            .catch(function (err) {
            // if canceled  keep loading set to true
            if (err.cancelled) {
                console.log('Panel request cancelled', err);
                return;
            }
            _this.loading = false;
            _this.error = err.message || 'Request Error';
            _this.inspector = { error: err };
            if (err.data) {
                if (err.data.message) {
                    _this.error = err.data.message;
                }
                if (err.data.error) {
                    _this.error = err.data.error;
                }
            }
            _this.events.emit('data-error', err);
            console.log('Panel data error:', err);
        });
    };
    MetricsPanelCtrl.prototype.updateTimeRange = function (datasource) {
        this.datasource = datasource || this.datasource;
        this.range = this.timeSrv.timeRange();
        this.resolution = getResolution(this.panel);
        var newTimeData = applyPanelTimeOverrides(this.panel, this.range);
        this.timeInfo = newTimeData.timeInfo;
        this.range = newTimeData.timeRange;
        this.calculateInterval();
        return this.datasource;
    };
    MetricsPanelCtrl.prototype.calculateInterval = function () {
        var intervalOverride = this.panel.interval;
        // if no panel interval check datasource
        if (intervalOverride) {
            intervalOverride = this.templateSrv.replace(intervalOverride, this.panel.scopedVars);
        }
        else if (this.datasource && this.datasource.interval) {
            intervalOverride = this.datasource.interval;
        }
        var res = kbn.calculateInterval(this.range, this.resolution, intervalOverride);
        this.interval = res.interval;
        this.intervalMs = res.intervalMs;
    };
    MetricsPanelCtrl.prototype.issueQueries = function (datasource) {
        this.datasource = datasource;
        if (!this.panel.targets || this.panel.targets.length === 0) {
            return this.$q.when([]);
        }
        // make shallow copy of scoped vars,
        // and add built in variables interval and interval_ms
        var scopedVars = Object.assign({}, this.panel.scopedVars, {
            __interval: { text: this.interval, value: this.interval },
            __interval_ms: { text: this.intervalMs, value: this.intervalMs },
        });
        var metricsQuery = {
            timezone: this.dashboard.getTimezone(),
            panelId: this.panel.id,
            dashboardId: this.dashboard.id,
            range: this.range,
            rangeRaw: this.range.raw,
            interval: this.interval,
            intervalMs: this.intervalMs,
            targets: this.panel.targets,
            maxDataPoints: this.resolution,
            scopedVars: scopedVars,
            cacheTimeout: this.panel.cacheTimeout,
        };
        return datasource.query(metricsQuery);
    };
    MetricsPanelCtrl.prototype.handleQueryResult = function (result) {
        this.loading = false;
        // check for if data source returns subject
        if (result && result.subscribe) {
            this.handleDataStream(result);
            return;
        }
        if (this.dashboard.snapshot) {
            this.panel.snapshotData = result.data;
        }
        if (!result || !result.data) {
            console.log('Data source query result invalid, missing data field:', result);
            result = { data: [] };
        }
        this.events.emit('data-received', result.data);
    };
    MetricsPanelCtrl.prototype.handleDataStream = function (stream) {
        var _this = this;
        // if we already have a connection
        if (this.dataStream) {
            console.log('two stream observables!');
            return;
        }
        this.dataStream = stream;
        this.dataSubscription = stream.subscribe({
            next: function (data) {
                console.log('dataSubject next!');
                if (data.range) {
                    _this.range = data.range;
                }
                _this.events.emit('data-received', data.data);
            },
            error: function (error) {
                _this.events.emit('data-error', error);
                console.log('panel: observer got error');
            },
            complete: function () {
                console.log('panel: observer got complete');
                _this.dataStream = null;
            },
        });
    };
    MetricsPanelCtrl.prototype.getAdditionalMenuItems = function () {
        var items = [];
        if (this.contextSrv.hasAccessToExplore() && this.datasource) {
            items.push({
                text: 'Explore',
                click: 'ctrl.explore();',
                icon: 'gicon gicon-explore',
                shortcut: 'x',
            });
        }
        return items;
    };
    MetricsPanelCtrl.prototype.explore = function () {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var url;
            var _this = this;
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, getExploreUrl(this.panel, this.panel.targets, this.datasource, this.datasourceSrv, this.timeSrv)];
                    case 1:
                        url = _a.sent();
                        if (url) {
                            this.$timeout(function () { return _this.$location.url(url); });
                        }
                        return [2 /*return*/];
                }
            });
        });
    };
    return MetricsPanelCtrl;
}(PanelCtrl));
export { MetricsPanelCtrl };
//# sourceMappingURL=metrics_panel_ctrl.js.map