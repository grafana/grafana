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

export interface GraphWithLegendProps extends GraphProps, Omit<LegendOptions, keyof LegendBasicOptions> {
  isLegendVisible: boolean;
  renderLegendAs: React.ComponentType<LegendComponentProps>;
}

export const GraphWithLegend: React.FunctionComponent<GraphWithLegendProps> = ({
  series,
  timeRange,
  width,
  height,
  showBars,
  showLines,
  showPoints,
  isLegendVisible,
  renderLegendAs,
  placement,
  stats,
}) => {
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

  return (
    // TODO: migrate to Emotion
    <div
      className={css`
        display: flex;
        flex-direction: ${placement === 'under' ? 'column' : 'row'};
        height: 100%;
      `}
    >
      <div
        className={css`
          min-height: 65%;
          flex-grow: 1;
        `}
      >
        <Graph
          series={graphSeriesModel}
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
        <div
          className={css`
            padding: 10px 0;
          `}
        >
          <GraphLegend
            items={legendItems}
            renderLegendAs={renderLegendAs}
            statsToDisplay={stats}
            onLabelClick={item => {
              const action = item.isVisible ? hideSeries : showSeries;
              action([item.label]);
            }}
            onSeriesColorChange={() => {}}
            onToggleAxis={() => {}}
          />
        </div>
      )}
    </div>
  );
};
