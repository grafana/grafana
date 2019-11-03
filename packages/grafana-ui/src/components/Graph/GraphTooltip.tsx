import React from 'react';
import { stylesFactory, useTheme } from '../../themes';
import { css, cx } from 'emotion';
import {
  getTimeZoneDateFormatter,
  dateTime,
  Dimensions,
  Dimension,
  getValueFromDimension,
  getColumnFromDimension,
  GrafanaTheme,
} from '@grafana/data';
import { TooltipContentProps, TooltipMode } from '../Chart/Tooltip';
import { SeriesIcon } from '../Legend/SeriesIcon';
import { getMultiSeriesGraphHoverInfo } from './utils';

export interface GraphTooltipOptions {
  mode: TooltipMode;
}
export interface GraphDimensions extends Dimensions {
  xAxis: Dimension<number>;
  yAxis: Dimension<number>;
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

export const GraphTooltip: React.FC<TooltipContentProps<GraphDimensions>> = ({
  pos,
  mode = 'single',
  dimensions,
  activeDimensions,
  timeZone,
}) => {
  const theme = useTheme();
  const styles = getGraphTooltipStyles(theme);
  const dateFormatter = getTimeZoneDateFormatter(timeZone);

  let content = null;

  // When
  // [1] no active dimension or
  // [2] no xAxis position
  // we assume no tooltip should be rendered
  if (!activeDimensions || !activeDimensions.xAxis) {
    return null;
  }

  if (mode === 'single') {
    // not hovering over a point, skip rendering
    if (activeDimensions.yAxis === null) {
      return null;
    }

    // Assuming single x-axis, time
    // Active dimension x-axis indicates a time field corresponding to y-axis value
    const time = getValueFromDimension(dimensions.xAxis, activeDimensions.xAxis[0], activeDimensions.xAxis[1]);
    const valueField = getColumnFromDimension(dimensions.yAxis, activeDimensions.yAxis[0]);
    const value = getValueFromDimension(dimensions.yAxis, activeDimensions.yAxis[0], activeDimensions.yAxis[1]);
    const processedValue = valueField.display ? valueField.display(value).text : value;

    content = (
      <>
        {<div aria-label="Timestamp">{dateFormatter(time)}</div>}
        <div className={styles.seriesTableRow}>
          <div className={styles.seriesTableCell}>
            {valueField.config.color && <SeriesIcon color={valueField.config.color} />} {valueField.name}
          </div>
          <div className={cx(styles.seriesTableCell, styles.value)}>{processedValue}</div>
        </div>
      </>
    );
  } else {
    const time = activeDimensions.xAxis[1];
    const hoverInfo = getMultiSeriesGraphHoverInfo(dimensions.yAxis.columns, dimensions.xAxis.columns, time);
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
        {timestamp && <div aria-label="Timestamp">{dateFormatter(timestamp)}</div>}
        {seriesTable}
      </>
    );
  }

  return content;
};

GraphTooltip.displayName = 'GraphTooltip';
