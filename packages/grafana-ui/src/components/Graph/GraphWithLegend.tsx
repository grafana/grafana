// Libraries
import _ from 'lodash';
import React, { useEffect, useState } from 'react';

import { css } from 'emotion';
import { Graph, GraphProps } from './Graph';
import { useGraphLegend } from './useGraphLegend';
import { GraphSeriesXY } from '../../types/graph';
import { LegendComponentProps, LegendOptions, LegendBasicOptions } from '../Legend/Legend';
import { Omit } from '../../types/utils';
import { GraphLegend } from './GraphLegend';

export type SeriesColorChangeHandler = (label: string, color: string) => void;
export type SeriesAxisToggleHandler = (label: string, useRightYAxis: boolean) => void;

export interface GraphWithLegendProps extends GraphProps, Omit<LegendOptions, keyof LegendBasicOptions> {
  isLegendVisible: boolean;
  renderLegendAs: React.ComponentType<LegendComponentProps>;
  onSeriesColorChange: SeriesColorChangeHandler;
  onSeriesAxisToggle?: SeriesAxisToggleHandler;
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
    isLegendVisible,
    renderLegendAs,
    stats,
    onSeriesColorChange,
    onSeriesAxisToggle,
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
            renderLegendAs={renderLegendAs}
            statsToDisplay={stats}
            onLabelClick={item => {
              // TODO: handle keyboard
              const action = item.isVisible ? hideSeries : showSeries;
              action([item.label]);
            }}
            onSeriesColorChange={onSeriesColorChange}
            onSeriesAxisToggle={onSeriesAxisToggle}
          />
        </div>
      )}
    </div>
  );
};
