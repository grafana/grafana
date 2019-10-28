import React from 'react';
import { stylesFactory, useTheme } from '../../themes';
import { GrafanaTheme } from '../../types/theme';
import { css, cx } from 'emotion';
import { getTimeZoneDateFormatter, dateTime } from '@grafana/data';
import { TooltipContentProps, TooltipMode } from '../Chart/Tooltip';
import { SeriesIcon } from '../Legend/SeriesIcon';
import { getMultiSeriesGraphHoverInfo } from './utils';

export interface GraphTooltipOptions {
  mode: TooltipMode;
}

const getGraphTooltipStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    seriesTable: css`
      display: table;
    `,
    seriesTableRow: css`
      display: table-row;
    `,
    seriesTableCell: css`
      display: table-cell;
    `,
    value: css`
      padding-left: ${theme.spacing.md};
    `,
    activeSeries: css`
      font-weight: ${theme.typography.weight.bold};
    `,
  };
});

export const GraphTooltip: React.FC<TooltipContentProps> = ({
  series,
  seriesIndex,
  datapointIndex,
  pos,
  mode = 'single',
  timeZone,
}) => {
  const theme = useTheme();
  const styles = getGraphTooltipStyles(theme);
  const dateFormatter = getTimeZoneDateFormatter(timeZone);

  let content;

  if (!series) {
    return null;
  }

  if (mode === 'single') {
    if (seriesIndex !== undefined && datapointIndex !== undefined) {
      const activeSeries = series[seriesIndex];

      const activeDatapoint = activeSeries.data[datapointIndex];
      const timestamp = activeDatapoint[0];
      const processedValue = activeSeries.yAxisDisplayProcessor
        ? activeSeries.yAxisDisplayProcessor(activeDatapoint[1]).text
        : activeDatapoint[1];

      content = (
        <>
          {timestamp && <div>{dateFormatter(timestamp)}</div>}
          <div className={styles.seriesTableRow}>
            <div className={styles.seriesTableCell}>
              <SeriesIcon color={activeSeries.color} /> {activeSeries.label}
            </div>
            <div className={cx(styles.seriesTableCell, styles.value)}>{processedValue}</div>
          </div>
        </>
      );
    } else {
      return null;
    }
  } else {
    const hoverInfo = getMultiSeriesGraphHoverInfo(series, pos);
    const timestamp = hoverInfo.time && dateTime(hoverInfo.time);
    const seriesTable = hoverInfo.results.map(s => {
      const displayProcessor = series[s.seriesIndex].yAxisDisplayProcessor;
      const processedValue = displayProcessor ? displayProcessor(s.value).text : s.value;
      return (
        <div className={styles.seriesTableRow}>
          <div className={cx(styles.seriesTableCell, seriesIndex === s.seriesIndex && styles.activeSeries)}>
            <SeriesIcon color={s.color} /> {s.label}
          </div>
          <div className={cx(styles.seriesTableCell, styles.value)}>{processedValue}</div>
        </div>
      );
    });
    content = (
      <>
        {timestamp && <div>{dateFormatter(timestamp)}</div>}
        {seriesTable}
      </>
    );
  }

  return content;
};

GraphTooltip.displayName = 'GraphTooltip';
