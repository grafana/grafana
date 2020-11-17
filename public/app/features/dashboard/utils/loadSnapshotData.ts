import { applyFieldOverrides, DefaultTimeRange, LoadingState, PanelData } from '@grafana/data';
import { config } from 'app/core/config';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { DashboardModel, PanelModel } from '../state';
import { getProcessedDataFrames } from '../state/runRequest';

export function loadSnapshotData(panel: PanelModel, dashboard: DashboardModel): PanelData {
  const data = getProcessedDataFrames(panel.snapshotData);

  return {
    timeRange: DefaultTimeRange,
    state: LoadingState.Done,
    series: applyFieldOverrides({
      data,
      fieldConfig: {
        defaults: {},
        overrides: [],
      },
      autoMinMax: true,
      replaceVariables: panel.replaceVariables,
      getDataSourceSettingsByUid: getDatasourceSrv().getDataSourceSettingsByUid.bind(getDatasourceSrv()),
      fieldConfigRegistry: panel.plugin!.fieldConfigRegistry,
      theme: config.theme,
      timeZone: dashboard.getTimezone(),
    }),
  };
}
