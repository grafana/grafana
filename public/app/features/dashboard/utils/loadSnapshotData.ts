import { applyFieldOverrides, ArrayDataFrame, getDefaultTimeRange, LoadingState, PanelData } from '@grafana/data';
import { config } from 'app/core/config';
import { DashboardModel, PanelModel } from '../state';
import { getProcessedDataFrames } from '../../query/state/runRequest';
import { SnapshotWorker } from '../../query/state/DashboardQueryRunner/SnapshotWorker';
import { DashboardQueryRunnerImpl } from '../../query/state/DashboardQueryRunner/DashboardQueryRunner';

export function loadSnapshotData(panel: PanelModel, dashboard: DashboardModel): PanelData {
  const data = getProcessedDataFrames(panel.snapshotData);
  const worker = new SnapshotWorker();
  const options = { dashboard, range: getDefaultTimeRange() };
  const annotationEvents = worker.canWork(options)
    ? worker
        .getAnnotationsFromSnapshot(options)
        .filter((item) => DashboardQueryRunnerImpl.getPanelAnnotationsFilter(item, panel.id))
    : [];
  const annotations = [new ArrayDataFrame(annotationEvents)];

  return {
    timeRange: getDefaultTimeRange(),
    state: LoadingState.Done,
    series: applyFieldOverrides({
      data,
      fieldConfig: {
        defaults: {},
        overrides: [],
      },
      replaceVariables: panel.replaceVariables,
      fieldConfigRegistry: panel.plugin!.fieldConfigRegistry,
      theme: config.theme,
      timeZone: dashboard.getTimezone(),
    }),
    annotations,
  };
}
