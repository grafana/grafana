// Libraries
import _ from 'lodash';
import React, { useEffect, useState } from 'react';

import { css } from 'emotion';
import { Graph, GraphProps } from './Graph';
import { useGraphLegend } from './useGraphLegend';
import { GraphSeriesXY } from '../../types/graph';
import { LegendRenderOptions } from '../Legend/Legend';
import { GraphLegend } from './GraphLegend';

export type SeriesColorChangeHandler = (label: string, color: string) => void;
export type SeriesAxisToggleHandler = (label: string, useRightYAxis: boolean) => void;

export interface GraphWithLegendProps extends GraphProps, LegendRenderOptions {
  decimals?: number;
  isLegendVisible: boolean;
  renderLegendAsTable: boolean;
  sortLegendBy?: string;
  sortLegendDesc?: boolean;
  onSeriesColorChange: SeriesColorChangeHandler;
  onSeriesAxisToggle?: SeriesAxisToggleHandler;
  onToggleSort: (sortBy: string, sortDesc: boolean) => void;
}

const getGraphWithLegendStyles = ({ placement }: GraphWithLegendProps) => ({
  wrapper: css`
    display: flex;
    flex-direction: ${placement === 'under' ? 'column' : 'row'};
    height: 100%;
  `,
  graphContainer: css`
    min-height: 65%;
    flex-grow: 1;
  `,
  legendContainer: css`
    padding: 10px 0;
  `,
});

export const GraphWithLegend: React.FunctionComponent<GraphWithLegendProps> = (props: GraphWithLegendProps) => {
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
    isLegendVisible,
    renderLegendAsTable,
    placement,
    onSeriesColorChange,
    onSeriesAxisToggle,
    onToggleSort,
  } = props;
  const [graphSeriesModel, setGraphSeriesModel] = useState<GraphSeriesXY[]>(series);
  const { legendItems, hiddenSeries, showSeries, hideSeries, isSeriesVisible } = useGraphLegend(graphSeriesModel);

  useEffect(() => {
    setGraphSeriesModel(
      series.map(s => ({
        ...s,
        isVisible: isSeriesVisible(s.label),
      }))
    );
  }, [hiddenSeries, series]);

  const { graphContainer, legendContainer, wrapper } = getGraphWithLegendStyles(props);

  return (
    <div className={wrapper}>
      <div className={graphContainer}>
        <Graph
          series={graphSeriesModel.filter(s => !!s.isVisible)}
          timeRange={timeRange}
          showLines={showLines}
          showPoints={showPoints}
          showBars={showBars}
          width={width}
          height={height}
          key={isLegendVisible ? 'legend-visible' : 'legend-invisible'}
        />
      </div>

      {isLegendVisible && (
        <div className={legendContainer}>
          <GraphLegend
            items={legendItems}
            renderLegendAsTable={renderLegendAsTable}
            placement={placement}
            sortBy={sortLegendBy}
            sortDesc={sortLegendDesc}
            onLabelClick={item => {
              const action = item.isVisible ? hideSeries : showSeries;
              action([item.label]);
            }}
            onSeriesColorChange={onSeriesColorChange}
            onSeriesAxisToggle={onSeriesAxisToggle}
            onToggleSort={onToggleSort}
          />
        </div>
      )}
    </div>
  );
};
