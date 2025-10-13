import { css } from '@emotion/css';

import {
  FieldType,
  formattedValueToString,
  getDisplayProcessor,
  GrafanaTheme2,
  QueryResultMetaStat,
  TimeZone,
} from '@grafana/data';
import { useStyles2, useTheme2 } from '@grafana/ui';

interface InspectStatsTableProps {
  timeZone: TimeZone;
  name: string;
  stats: QueryResultMetaStat[];
}

export const InspectStatsTable = ({ timeZone, name, stats }: InspectStatsTableProps) => {
  const theme = useTheme2();
  const styles = useStyles2(getStyles);

  if (!stats || !stats.length) {
    return null;
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.heading}>{name}</div>
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

const getStyles = (theme: GrafanaTheme2) => ({
  heading: css({
    fontSize: theme.typography.body.fontSize,
    marginBottom: theme.spacing(1),
  }),
  wrapper: css({
    paddingBottom: theme.spacing(2),
  }),
  cell: css({
    textAlign: 'right',
  }),
});
