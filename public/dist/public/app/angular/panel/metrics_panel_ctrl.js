import { isArray } from 'lodash';
import { LoadingState, PanelEvents, toDataFrameDTO, toLegacyResponseData, } from '@grafana/data';
import { PanelCtrl } from 'app/angular/panel/panel_ctrl';
import { applyPanelTimeOverrides } from 'app/features/dashboard/utils/panel';
class MetricsPanelCtrl extends PanelCtrl {
    constructor($scope, $injector) {
        super($scope, $injector);
        this.skipDataOnInit = false;
        this.dataList = [];
        this.useDataFrames = false;
        // Updates the response with information from the stream
        this.panelDataObserver = {
            next: (data) => {
                this.panelData = data;
                if (data.state === LoadingState.Error) {
                    this.loading = false;
                    this.processDataError(data.error);
                }
                // Ignore data in loading state
                if (data.state === LoadingState.Loading) {
                    this.loading = true;
                    this.angularDirtyCheck();
                    return;
                }
                if (data.request) {
                    const { timeInfo } = data.request;
                    if (timeInfo) {
                        this.timeInfo = timeInfo;
                    }
                }
                if (data.timeRange) {
                    this.range = data.timeRange;
                }
                if (this.useDataFrames) {
                    this.handleDataFrames(data.series);
                }
                else {
                    // Make the results look as if they came directly from a <6.2 datasource request
                    const legacy = data.series.map((v) => toLegacyResponseData(v));
                    this.handleQueryResult({ data: legacy });
                }
                this.angularDirtyCheck();
            },
        };
        this.contextSrv = $injector.get('contextSrv');
        this.datasourceSrv = $injector.get('datasourceSrv');
        this.timeSrv = $injector.get('timeSrv');
        this.templateSrv = $injector.get('templateSrv');
        this.panel.datasource = this.panel.datasource || null;
        this.events.on(PanelEvents.refresh, this.onMetricsPanelRefresh.bind(this));
        this.events.on(PanelEvents.panelTeardown, this.onPanelTearDown.bind(this));
        this.events.on(PanelEvents.componentDidMount, this.onMetricsPanelMounted.bind(this));
    }
    onMetricsPanelMounted() {
        const queryRunner = this.panel.getQueryRunner();
        this.querySubscription = queryRunner
            .getData({ withTransforms: true, withFieldConfig: true })
            .subscribe(this.panelDataObserver);
    }
    onPanelTearDown() {
        if (this.querySubscription) {
            this.querySubscription.unsubscribe();
            this.querySubscription = null;
        }
    }
    onMetricsPanelRefresh() {
        // ignore fetching data if another panel is in fullscreen
        if (this.otherPanelInFullscreenMode()) {
            return;
        }
        // if we have snapshot data use that
        if (this.panel.snapshotData) {
            this.updateTimeRange();
            let data = this.panel.snapshotData;
            // backward compatibility
            if (!isArray(data)) {
                data = data.data;
            }
            this.panelData = {
                state: LoadingState.Done,
                series: data,
                timeRange: this.range,
            };
            // Defer panel rendering till the next digest cycle.
            // For some reason snapshot panels don't init at this time, so this helps to avoid rendering issues.
            return this.$timeout(() => {
                this.events.emit(PanelEvents.dataSnapshotLoad, data);
            });
        }
        // clear loading/error state
        delete this.error;
        this.loading = true;
        // load datasource service
        return this.datasourceSrv
            .get(this.panel.datasource, this.panel.scopedVars)
            .then(this.issueQueries.bind(this))
            .catch((err) => {
            this.processDataError(err);
        });
    }
    processDataError(err) {
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
    }
    angularDirtyCheck() {
        if (!this.$scope.$root.$$phase) {
            this.$scope.$digest();
        }
    }
    updateTimeRange(datasource) {
        this.datasource = datasource || this.datasource;
        this.range = this.timeSrv.timeRange();
        const newTimeData = applyPanelTimeOverrides(this.panel, this.range);
        this.timeInfo = newTimeData.timeInfo;
        this.range = newTimeData.timeRange;
    }
    issueQueries(datasource) {
        this.updateTimeRange(datasource);
        this.datasource = datasource;
        const panel = this.panel;
        const queryRunner = panel.getQueryRunner();
        return queryRunner.run({
            datasource: panel.datasource,
            queries: panel.targets,
            panelId: panel.id,
            dashboardUID: this.dashboard.uid,
            timezone: this.dashboard.getTimezone(),
            timeInfo: this.timeInfo,
            timeRange: this.range,
            maxDataPoints: panel.maxDataPoints || this.width,
            minInterval: panel.interval,
            scopedVars: panel.scopedVars,
            cacheTimeout: panel.cacheTimeout,
            queryCachingTTL: panel.queryCachingTTL,
            transformations: panel.transformations,
        });
    }
    handleDataFrames(data) {
        this.loading = false;
        if (this.dashboard && this.dashboard.snapshot) {
            this.panel.snapshotData = data.map((frame) => toDataFrameDTO(frame));
        }
        try {
            this.events.emit(PanelEvents.dataFramesReceived, data);
        }
        catch (err) {
            this.processDataError(err);
        }
    }
    handleQueryResult(result) {
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
    }
}
export { MetricsPanelCtrl };
//# sourceMappingURL=metrics_panel_ctrl.js.map