import { PanelData, QueryResultMetaStat } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { InspectStatsTable } from './InspectStatsTable';
import React from 'react';
import { DashboardModel } from 'app/features/dashboard/state';

interface InspectStatsTabProps {
  data: PanelData;
  dashboard: DashboardModel;
}
export const InspectStatsTab: React.FC<InspectStatsTabProps> = ({ data, dashboard }) => {
  if (!data.request) {
    return null;
  }

  let stats: QueryResultMetaStat[] = [];

  const requestTime = data.request.endTime ? data.request.endTime - data.request.startTime : -1;
  const processingTime = data.timings?.dataProcessingTime || -1;
  let dataRows = 0;

  for (const frame of data.series) {
    dataRows += frame.length;
  }

  stats.push({ displayName: 'Total request time', value: requestTime, unit: 'ms' });
  stats.push({ displayName: 'Data processing time', value: processingTime, unit: 'ms' });
  stats.push({ displayName: 'Number of queries', value: data.request.targets.length });
  stats.push({ displayName: 'Total number rows', value: dataRows });

  let dataStats: QueryResultMetaStat[] = [];

  for (const series of data.series) {
    if (series.meta && series.meta.stats) {
      dataStats = dataStats.concat(series.meta.stats);
    }
  }

  return (
    <div aria-label={selectors.components.PanelInspector.Stats.content}>
      <InspectStatsTable dashboard={dashboard} name={'Stats'} stats={stats} />
      <InspectStatsTable dashboard={dashboard} name={'Data source stats'} stats={dataStats} />
    </div>
  );
};
