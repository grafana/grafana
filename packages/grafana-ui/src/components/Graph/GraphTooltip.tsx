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
  pos,
  mode = 'single',
  dimmensions,
  activeDimmensions,
  timeZone,
}) => {
  const theme = useTheme();
  const styles = getGraphTooltipStyles(theme);
  const dateFormatter = getTimeZoneDateFormatter(timeZone);

  let content;

  if (mode === 'single') {
    // not hovering over a point, skip rendering
    if (activeDimmensions.yAxis === undefined) {
      return null;
    }

    // Assuming single x-axis, time
    // Active dimension x-axis indicates a time field corresponding to y-axis value
    const timeField = dimmensions['xAxis'][activeDimmensions.xAxis[0]];
    const time = timeField.values.get(activeDimmensions.xAxis[1]);

    const activeField = dimmensions['yAxis'][activeDimmensions.yAxis[0]];
    const value = activeField.values.get(activeDimmensions.yAxis[1]);
    const processedValue = activeField.display ? activeField.display(value).text : value;

    content = (
      <>
        {<div>{dateFormatter(time)}</div>}
        <div className={styles.seriesTableRow}>
          <div className={styles.seriesTableCell}>
            {activeField.config.color && <SeriesIcon color={activeField.config.color} />} {activeField.name}
          </div>
          <div className={cx(styles.seriesTableCell, styles.value)}>{processedValue}</div>
        </div>
      </>
    );
  } else {
    // In multi mode active dimmentiosn
    const time = activeDimmensions.xAxis[1];
    const hoverInfo = getMultiSeriesGraphHoverInfo(dimmensions['yAxis'], dimmensions['xAxis'], time);
    const timestamp = hoverInfo.time && dateTime(hoverInfo.time);

    const seriesTable = hoverInfo.results.map(s => {
      return (
        <div className={styles.seriesTableRow} key={s.label}>
          <div className={cx(styles.seriesTableCell)}>
            {s.color && <SeriesIcon color={s.color} />} {s.label}
          </div>
          <div className={cx(styles.seriesTableCell, styles.value)}>{s.value}</div>
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
