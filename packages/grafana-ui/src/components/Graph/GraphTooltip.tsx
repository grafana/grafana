import React from 'react';
import { stylesFactory, useTheme, selectThemeVariant } from '../../themes';
import { GrafanaTheme } from '../../types/theme';
import { css, cx } from 'emotion';
import { GraphSeriesXY, getTimeZoneDateFormatter, TimeZone } from '@grafana/data';
import { SeriesIcon } from '../Legend/SeriesIcon';
import { FlotPosition, GraphTooltipMode, FlotItem } from './types';
// import { findHoverIndexFromData } from './utils';

export interface GraphTooltipProps {
  series: GraphSeriesXY[];
  activeItem?: FlotItem;
  timeZone: TimeZone;
  pos: FlotPosition;
  mode: GraphTooltipMode;
}

export interface GraphTooltipOptions {
  mode: GraphTooltipMode;
}

const getGraphTooltipStyles = stylesFactory((theme: GrafanaTheme) => {
  const bgColor = selectThemeVariant({ light: theme.colors.gray5, dark: theme.colors.dark1 }, theme.type);
  return {
    wrapper: css`
      overflow: hidden;
      background: ${bgColor};
      padding: ${theme.spacing.sm};
      border-radius: ${theme.border.radius.sm};
    `,
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

export const GraphTooltip: React.FC<GraphTooltipProps> = ({ series, activeItem, pos, mode = 'single', timeZone }) => {
  const theme = useTheme();
  const styles = getGraphTooltipStyles(theme);
  const dateFormatter = getTimeZoneDateFormatter(timeZone);

  let content;

  if (!series) {
    return null;
  }

  if (mode === 'single') {
    if (!activeItem) {
      return null;
    }
    const activeSeries = series[activeItem.seriesIndex];
    const processedValue = activeSeries.yAxisDisplayProcessor
      ? activeSeries.yAxisDisplayProcessor(activeItem.datapoint[1]).text
      : activeItem.datapoint[1];

    content = (
      <>
        <div>{dateFormatter(activeItem.datapoint[0])}</div>
        <div className={styles.seriesTableRow}>
          <div className={styles.seriesTableCell}>
            <SeriesIcon color={activeSeries.color} /> {activeSeries.label}
          </div>
          <div className={cx(styles.seriesTableCell, styles.value)}>{processedValue}</div>
        </div>
      </>
    );
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

  return <div className={styles.wrapper}>{content}</div>;
};

GraphTooltip.displayName = 'GraphTooltip';
