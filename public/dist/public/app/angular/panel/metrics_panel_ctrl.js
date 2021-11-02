import { __extends } from "tslib";
import { isArray } from 'lodash';
import { PanelCtrl } from 'app/angular/panel/panel_ctrl';
import { applyPanelTimeOverrides } from 'app/features/dashboard/utils/panel';
import { LoadingState, PanelEvents, toDataFrameDTO, toLegacyResponseData, } from '@grafana/data';
var MetricsPanelCtrl = /** @class */ (function (_super) {
    __extends(MetricsPanelCtrl, _super);
    function MetricsPanelCtrl($scope, $injector) {
        var _this = _super.call(this, $scope, $injector) || this;
        _this.skipDataOnInit = false;
        _this.dataList = [];
        _this.useDataFrames = false;
        // Updates the response with information from the stream
        _this.panelDataObserver = {
            next: function (data) {
                _this.panelData = data;
                if (data.state === LoadingState.Error) {
                    _this.loading = false;
                    _this.processDataError(data.error);
                }
                // Ignore data in loading state
                if (data.state === LoadingState.Loading) {
                    _this.loading = true;
                    _this.angularDirtyCheck();
                    return;
                }
                if (data.request) {
                    var timeInfo = data.request.timeInfo;
                    if (timeInfo) {
                        _this.timeInfo = timeInfo;
                    }
                }
                if (data.timeRange) {
                    _this.range = data.timeRange;
                }
                if (_this.useDataFrames) {
                    _this.handleDataFrames(data.series);
                }
                else {
                    // Make the results look as if they came directly from a <6.2 datasource request
                    var legacy = data.series.map(function (v) { return toLegacyResponseData(v); });
                    _this.handleQueryResult({ data: legacy });
                }
                _this.angularDirtyCheck();
            },
        };
        _this.contextSrv = $injector.get('contextSrv');
        _this.datasourceSrv = $injector.get('datasourceSrv');
        _this.timeSrv = $injector.get('timeSrv');
        _this.templateSrv = $injector.get('templateSrv');
        _this.panel.datasource = _this.panel.datasource || null;
        _this.events.on(PanelEvents.refresh, _this.onMetricsPanelRefresh.bind(_this));
        _this.events.on(PanelEvents.panelTeardown, _this.onPanelTearDown.bind(_this));
        _this.events.on(PanelEvents.componentDidMount, _this.onMetricsPanelMounted.bind(_this));
        return _this;
    }
    MetricsPanelCtrl.prototype.onMetricsPanelMounted = function () {
        var queryRunner = this.panel.getQueryRunner();
        this.querySubscription = queryRunner
            .getData({ withTransforms: true, withFieldConfig: true })
            .subscribe(this.panelDataObserver);
    };
    MetricsPanelCtrl.prototype.onPanelTearDown = function () {
        if (this.querySubscription) {
            this.querySubscription.unsubscribe();
            this.querySubscription = null;
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
            if (!isArray(data_1)) {
                data_1 = data_1.data;
            }
            this.panelData = {
                state: LoadingState.Done,
                series: data_1,
                timeRange: this.range,
            };
            // Defer panel rendering till the next digest cycle.
            // For some reason snapshot panels don't init at this time, so this helps to avoid rendering issues.
            return this.$timeout(function () {
                _this.events.emit(PanelEvents.dataSnapshotLoad, data_1);
            });
        }
        // clear loading/error state
        delete this.error;
        this.loading = true;
        // load datasource service
        return this.datasourceSrv
            .get(this.panel.datasource, this.panel.scopedVars)
            .then(this.issueQueries.bind(this))
            .catch(function (err) {
            _this.processDataError(err);
        });
    };
    MetricsPanelCtrl.prototype.processDataError = function (err) {
        // if canceled  keep loading set to true
        if (err.cancelled) {
            console.log('Panel request cancelled', err);
            return;
        }
        this.error = err.message || 'Request Error';
        if (err.data) {
            if (err.data.message) {
                this.error = err.data.message;
            }
            else if (err.data.error) {
                this.error = err.data.error;
            }
        }
        this.angularDirtyCheck();
    };
    MetricsPanelCtrl.prototype.angularDirtyCheck = function () {
        if (!this.$scope.$root.$$phase) {
            this.$scope.$digest();
        }
    };
    MetricsPanelCtrl.prototype.updateTimeRange = function (datasource) {
        this.datasource = datasource || this.datasource;
        this.range = this.timeSrv.timeRange();
        var newTimeData = applyPanelTimeOverrides(this.panel, this.range);
        this.timeInfo = newTimeData.timeInfo;
        this.range = newTimeData.timeRange;
    };
    MetricsPanelCtrl.prototype.issueQueries = function (datasource) {
        this.updateTimeRange(datasource);
        this.datasource = datasource;
        var panel = this.panel;
        var queryRunner = panel.getQueryRunner();
        return queryRunner.run({
            datasource: panel.datasource,
            queries: panel.targets,
            panelId: panel.id,
            dashboardId: this.dashboard.id,
            timezone: this.dashboard.getTimezone(),
            timeInfo: this.timeInfo,
            timeRange: this.range,
            maxDataPoints: panel.maxDataPoints || this.width,
            minInterval: panel.interval,
            scopedVars: panel.scopedVars,
            cacheTimeout: panel.cacheTimeout,
            transformations: panel.transformations,
        });
    };
    MetricsPanelCtrl.prototype.handleDataFrames = function (data) {
        this.loading = false;
        if (this.dashboard && this.dashboard.snapshot) {
            this.panel.snapshotData = data.map(function (frame) { return toDataFrameDTO(frame); });
        }
        try {
            this.events.emit(PanelEvents.dataFramesReceived, data);
        }
        catch (err) {
            this.processDataError(err);
        }
    };
    MetricsPanelCtrl.prototype.handleQueryResult = function (result) {
        this.loading = false;
        if (this.dashboard.snapshot) {
            this.panel.snapshotData = result.data;
        }
        if (!result || !result.data) {
            console.log('Data source query result invalid, missing data field:', result);
            result = { data: [] };
        }
        try {
            this.events.emit(PanelEvents.dataReceived, result.data);
        }
        catch (err) {
            this.processDataError(err);
        }
    };
    return MetricsPanelCtrl;
}(PanelCtrl));
export { MetricsPanelCtrl };
//# sourceMappingURL=metrics_panel_ctrl.js.map