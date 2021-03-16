import { applyFieldOverrides, getDefaultTimeRange, LoadingState, PanelData } from '@grafana/data';
import { config } from 'app/core/config';
import { DashboardModel, PanelModel } from '../state';
import { getProcessedDataFrames } from '../../query/state/runRequest';

export function loadSnapshotData(panel: PanelModel, dashboard: DashboardModel): PanelData {
  const data = getProcessedDataFrames(panel.snapshotData);

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
  };
}
