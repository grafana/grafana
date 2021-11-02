import { applyFieldOverrides, ArrayDataFrame, getDefaultTimeRange, LoadingState } from '@grafana/data';
import { config } from 'app/core/config';
import { getProcessedDataFrames } from '../../query/state/runRequest';
import { SnapshotWorker } from '../../query/state/DashboardQueryRunner/SnapshotWorker';
import { applyPanelTimeOverrides } from './panel';
import { getTimeSrv } from '../services/TimeSrv';
export function loadSnapshotData(panel, dashboard) {
    var data = getProcessedDataFrames(panel.snapshotData);
    var worker = new SnapshotWorker();
    var options = { dashboard: dashboard, range: getDefaultTimeRange() };
    var annotationEvents = worker.canWork(options) ? worker.getAnnotationsInSnapshot(dashboard, panel.id) : [];
    var annotations = [new ArrayDataFrame(annotationEvents)];
    var timeData = applyPanelTimeOverrides(panel, getTimeSrv().timeRange());
    return {
        timeRange: timeData.timeRange,
        state: LoadingState.Done,
        series: applyFieldOverrides({
            data: data,
            fieldConfig: {
                defaults: {},
                overrides: [],
            },
            replaceVariables: panel.replaceVariables,
            fieldConfigRegistry: panel.plugin.fieldConfigRegistry,
            theme: config.theme2,
            timeZone: dashboard.getTimezone(),
        }),
        annotations: annotations,
    };
}
//# sourceMappingURL=loadSnapshotData.js.map