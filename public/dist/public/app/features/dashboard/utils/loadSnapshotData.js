import { applyFieldOverrides, arrayToDataFrame, getDefaultTimeRange, getProcessedDataFrames, LoadingState, } from '@grafana/data';
import { config } from 'app/core/config';
import { SnapshotWorker } from '../../query/state/DashboardQueryRunner/SnapshotWorker';
import { getTimeSrv } from '../services/TimeSrv';
import { applyPanelTimeOverrides } from './panel';
export function loadSnapshotData(panel, dashboard) {
    const data = getProcessedDataFrames(panel.snapshotData);
    const worker = new SnapshotWorker();
    const options = { dashboard, range: getDefaultTimeRange() };
    const annotationEvents = worker.canWork(options) ? worker.getAnnotationsInSnapshot(dashboard, panel.id) : [];
    const annotations = [arrayToDataFrame(annotationEvents)];
    const timeData = applyPanelTimeOverrides(panel, getTimeSrv().timeRange());
    return {
        timeRange: timeData.timeRange,
        state: LoadingState.Done,
        series: applyFieldOverrides({
            data,
            fieldConfig: {
                defaults: {},
                overrides: [],
            },
            replaceVariables: panel.replaceVariables,
            fieldConfigRegistry: panel.plugin.fieldConfigRegistry,
            theme: config.theme2,
            timeZone: dashboard.getTimezone(),
        }),
        structureRev: 1,
        annotations,
    };
}
//# sourceMappingURL=loadSnapshotData.js.map