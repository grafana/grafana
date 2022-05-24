import { css } from '@emotion/css';
import React from 'react';

import {
  FieldType,
  formattedValueToString,
  getDisplayProcessor,
  GrafanaTheme2,
  QueryResultMetaStat,
  TimeZone,
} from '@grafana/data';
import { stylesFactory, useTheme2 } from '@grafana/ui';

interface InspectStatsTableProps {
  timeZone: TimeZone;
  name: string;
  stats: QueryResultMetaStat[];
}

export const InspectStatsTable: React.FC<InspectStatsTableProps> = ({ timeZone, name, stats }) => {
  const theme = useTheme2();
  const styles = getStyles(theme);

  if (!stats || !stats.length) {
    return null;
  }

  return (
    <div className={styles.wrapper}>
      <div className="section-heading">{name}</div>
      <table className="filter-table width-30">
        <tbody>
          {stats.map((stat, index) => {
            return (
              <tr key={`${stat.displayName}-${index}`}>
                <td>{stat.displayName}</td>
                <td className={styles.cell}>{formatStat(stat, timeZone, theme)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

function formatStat(stat: QueryResultMetaStat, timeZone: TimeZone, theme: GrafanaTheme2): string {
  const display = getDisplayProcessor({
    field: {
      type: FieldType.number,
      config: stat,
    },
    theme,
    timeZone,
  });
  return formattedValueToString(display(stat.value));
}

const getStyles = stylesFactory((theme: GrafanaTheme2) => {
  return {
    wrapper: css`
      padding-bottom: ${theme.spacing(2)};
    `,
    cell: css`
      text-align: right;
    `,
  };
});
