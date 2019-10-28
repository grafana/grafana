import React from 'react';
import { stylesFactory, useTheme } from '../../themes';
import { GrafanaTheme } from '../../types/theme';
import { css, cx } from 'emotion';
import { getTimeZoneDateFormatter } from '@grafana/data';
import { TooltipContentProps, TooltipMode } from '../Chart/Tooltip';
import { SeriesIcon } from '../Legend/SeriesIcon';

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
    content = <div>Multi</div>;
  }
  // content = (
  //   <>
  //     {series &&
  //       series.map(s => {
  //         // Not sure relying on label is the best way here
  //         const isActive = activeItem && s.label === activeItem.series.label;
  //         const hoverIndex = findHoverIndexFromData(pos!.x, s);
  //         const processedValue = s.yAxisDisplayProcessor
  //           ? s.yAxisDisplayProcessor(s.data[hoverIndex][1]).text
  //           : s.data[hoverIndex][1];

  //         let content = (
  //           <div className={styles.seriesTableRow}>
  //             <div className={styles.seriesTableCell}>
  //               <SeriesIcon color={s.color} /> {s.label}
  //             </div>
  //             <div className={cx(styles.seriesTableCell, styles.value)}>{processedValue}</div>
  //           </div>
  //         );

  //         if (isActive) {
  //           content = <strong>{content}</strong>;
  //         }

  //         return <div className={styles.seriesTable}>{content}</div>;
  //       })}
  //   </>
  // );
  // }

  return content;
};

GraphTooltip.displayName = 'GraphTooltip';
