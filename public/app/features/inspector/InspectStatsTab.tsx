import { css } from '@emotion/css';

import { PanelData, QueryResultMetaStat, TimeZone } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from 'app/core/internationalization';

import { InspectStatsTable } from './InspectStatsTable';
import { InspectStatsTraceIdsTable } from './InspectStatsTraceIdsTable';

interface InspectStatsTabProps {
  data: PanelData;
  timeZone: TimeZone;
}

export const InspectStatsTab = ({ data, timeZone }: InspectStatsTabProps) => {
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

  if (requestTime > 0) {
    stats.push({
      displayName: t('dashboard.inspect-stats.request-time', 'Total request time'),
      value: requestTime,
      unit: 'ms',
    });
  }
  if (processingTime > 0) {
    stats.push({
      displayName: t('dashboard.inspect-stats.processing-time', 'Data processing time'),
      value: processingTime,
      unit: 'ms',
    });
  }
  stats.push({
    displayName: t('dashboard.inspect-stats.queries', 'Number of queries'),
    value: data.request.targets?.length ?? 0,
  });
  stats.push({
    displayName: t('dashboard.inspect-stats.rows', 'Total number rows'),
    value: dataRows,
  });

  let dataStats: QueryResultMetaStat[] = [];

  for (const series of data.series) {
    if (series.meta && series.meta.stats) {
      dataStats = dataStats.concat(series.meta.stats);
    }
  }

  const statsTableName = t('dashboard.inspect-stats.table-title', 'Stats');
  const dataStatsTableName = t('dashboard.inspect-stats.data-title', 'Data source stats');
  const traceIdsStatsTableName = t('dashboard.inspect-stats.data-traceids', 'Trace IDs');

  return (
    <div aria-label={selectors.components.PanelInspector.Stats.content} className={containerStyles}>
      <InspectStatsTable timeZone={timeZone} name={statsTableName} stats={stats} />
      <InspectStatsTable timeZone={timeZone} name={dataStatsTableName} stats={dataStats} />
      <InspectStatsTraceIdsTable name={traceIdsStatsTableName} traceIds={data.traceIds ?? []} />
    </div>
  );
};

const containerStyles = css({
  height: '100%',
  overflowY: 'scroll',
});
