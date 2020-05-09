import React from 'react';
import { FieldType, formattedValueToString, getDisplayProcessor, QueryResultMetaStat, TimeZone } from '@grafana/data';
import { DashboardModel } from 'app/features/dashboard/state';
import { config } from 'app/core/config';

interface InspectStatsTableProps {
  dashboard: DashboardModel;
  name: string;
  stats: QueryResultMetaStat[];
}
export const InspectStatsTable: React.FC<InspectStatsTableProps> = ({ dashboard, name, stats }) => {
  if (!stats || !stats.length) {
    return null;
  }

  return (
    <div style={{ paddingBottom: '16px' }}>
      <div className="section-heading">{name}</div>
      <table className="filter-table width-30">
        <tbody>
          {stats.map((stat, index) => {
            return (
              <tr key={`${stat.title}-${index}`}>
                <td>{stat.title}</td>
                <td style={{ textAlign: 'right' }}>{formatStat(stat, dashboard.getTimezone())}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

function formatStat(stat: QueryResultMetaStat, timeZone?: TimeZone): string {
  const display = getDisplayProcessor({
    field: {
      type: FieldType.number,
      config: stat,
    },
    theme: config.theme,
    timeZone,
  });
  return formattedValueToString(display(stat.value));
}
