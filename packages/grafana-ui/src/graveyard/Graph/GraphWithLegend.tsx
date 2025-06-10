// Libraries

import { css } from '@emotion/css';
import * as React from 'react';

import { GrafanaTheme2, GraphSeriesValue } from '@grafana/data';
import { LegendDisplayMode, LegendPlacement } from '@grafana/schema';

import { CustomScrollbar } from '../../components/CustomScrollbar/CustomScrollbar';
import { VizLegend } from '../../components/VizLegend/VizLegend';
import { VizLegendItem } from '../../components/VizLegend/types';
import { useStyles2 } from '../../themes/ThemeContext';

import { Graph, GraphProps } from './Graph';

export interface GraphWithLegendProps extends GraphProps {
  legendDisplayMode: LegendDisplayMode;
  legendVisibility: boolean;
  placement: LegendPlacement;
  hideEmpty?: boolean;
  hideZero?: boolean;
  sortLegendBy?: string;
  sortLegendDesc?: boolean;
  onSeriesToggle?: (label: string, event: React.MouseEvent<HTMLElement>) => void;
  onToggleSort: (sortBy: string) => void;
}

const shouldHideLegendItem = (data: GraphSeriesValue[][], hideEmpty = false, hideZero = false) => {
  const isZeroOnlySeries = data.reduce((acc, current) => acc + (current[1] || 0), 0) === 0;
  const isNullOnlySeries = !data.reduce((acc, current) => acc && current[1] !== null, true);

  return (hideEmpty && isNullOnlySeries) || (hideZero && isZeroOnlySeries);
};

export const GraphWithLegend = (props: GraphWithLegendProps) => {
  const {
    series,
    timeRange,
    width,
    height,
    showBars,
    showLines,
    showPoints,
    sortLegendBy,
    sortLegendDesc,
    legendDisplayMode,
    legendVisibility,
    placement,
    onSeriesToggle,
    onToggleSort,
    hideEmpty,
    hideZero,
    isStacked,
    lineWidth,
    onHorizontalRegionSelected,
    timeZone,
    children,
    ariaLabel,
  } = props;
  const { graphContainer, wrapper, legendContainer } = useStyles2(getGraphWithLegendStyles, props.placement);

  const legendItems = series.reduce<VizLegendItem[]>((acc, s) => {
    return shouldHideLegendItem(s.data, hideEmpty, hideZero)
      ? acc
      : acc.concat([
          {
            label: s.label,
            color: s.color || '',
            disabled: !s.isVisible,
            yAxis: s.yAxis.index,
            getDisplayValues: () => s.info || [],
          },
        ]);
  }, []);

  return (
    <div className={wrapper} aria-label={ariaLabel}>
      <div className={graphContainer}>
        <Graph
          series={series}
          timeRange={timeRange}
          timeZone={timeZone}
          showLines={showLines}
          showPoints={showPoints}
          showBars={showBars}
          width={width}
          height={height}
          isStacked={isStacked}
          lineWidth={lineWidth}
          onHorizontalRegionSelected={onHorizontalRegionSelected}
        >
          {children}
        </Graph>
      </div>

      {legendVisibility && (
        <div className={legendContainer}>
          <CustomScrollbar hideHorizontalTrack>
            <VizLegend
              items={legendItems}
              displayMode={legendDisplayMode}
              placement={placement}
              sortBy={sortLegendBy}
              sortDesc={sortLegendDesc}
              onLabelClick={(item, event) => {
                if (onSeriesToggle) {
                  onSeriesToggle(item.label, event);
                }
              }}
              onToggleSort={onToggleSort}
            />
          </CustomScrollbar>
        </div>
      )}
    </div>
  );
};

const getGraphWithLegendStyles = (_theme: GrafanaTheme2, placement: LegendPlacement) => ({
  wrapper: css({
    display: 'flex',
    flexDirection: placement === 'bottom' ? 'column' : 'row',
  }),
  graphContainer: css({
    minHeight: '65%',
    flexGrow: 1,
  }),
  legendContainer: css({
    padding: '10px 0',
    maxHeight: placement === 'bottom' ? '35%' : 'none',
  }),
});
