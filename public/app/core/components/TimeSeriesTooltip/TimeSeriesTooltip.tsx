import _ from 'lodash';
import React, { PureComponent, ReactNode } from 'react';
import { TimeSeriesVM } from 'app/types';
import { FlotHoverItem } from 'app/types/events';
import { getMultiSeriesPlotHoverInfo, PlotHoverInfo } from './utils';
import TimeAxisTooltip from './TimeAxisTooltip';

export interface TimeSeriesTooltipProps {
  series: TimeSeriesVM[];
  allSeriesMode?: boolean;
  hideEmpty?: boolean;
  hideZero?: boolean;
  valueType?: 'individual' | 'cumulative';
  sort?: 1 | 2 | null;
  /**
   * Throttle series hover info calculation. Due to high execution cost of this function, it may
   * improve tooltip rendering performance, especially on large dashboards with shared tooltip enabled.
   */
  throttle?: boolean;
  throttleInterval?: number;
  onHighlight?: (series, datapoint) => void;
  onUnhighlight?: () => void;
}

interface TimeSeriesTooltipRenderProps {
  children: (series: TimeSeriesVM[], item: FlotHoverItem, timestamp: number, hoverInfo: PlotHoverInfo) => ReactNode;
}

export interface InjectedTimeSeriesTooltipProps {
  series: TimeSeriesVM[];
  item: FlotHoverItem;
  timestamp: number;
  hoverInfo: PlotHoverInfo;
}

type ComponentProps = TimeSeriesTooltipProps & TimeSeriesTooltipRenderProps;

export class TimeSeriesTooltip extends PureComponent<ComponentProps> {
  seriesHoverInfo: PlotHoverInfo | null;
  calculateHoverInfo: (position) => void;

  static defaultProps: Partial<TimeSeriesTooltipProps> = {
    sort: null,
    valueType: 'individual',
    throttle: true,
    throttleInterval: 100,
    onHighlight: () => {},
    onUnhighlight: () => {},
  };

  constructor(props) {
    super(props);

    // Series hover info calculation has excessive cost so it makes sense to throttle function execution.
    if (this.props.throttle) {
      this.calculateHoverInfo = _.throttle(position => this.getHoverInfo(position), this.props.throttleInterval, {
        leading: true,
      });
    } else {
      this.calculateHoverInfo = position => this.getHoverInfo(position);
    }
  }

  highlightPoints(seriesHoverInfo: PlotHoverInfo) {
    const { series } = this.props;
    this.props.onUnhighlight();
    for (let i = 0; i < series.length; i++) {
      const hoverInfo = seriesHoverInfo[i];
      if (!hoverInfo.hidden) {
        this.props.onHighlight(hoverInfo.index, hoverInfo.hoverIndex);
      }
    }
  }

  sortHoverInfo(seriesHoverInfo) {
    // Dynamically reorder the hovercard for the current time point if the option is enabled.
    if (this.props.sort === 2) {
      seriesHoverInfo.sort((a, b) => {
        return b.value - a.value;
      });
    } else if (this.props.sort === 1) {
      seriesHoverInfo.sort((a, b) => {
        return a.value - b.value;
      });
    }
  }

  getHoverInfo(position) {
    const { series, allSeriesMode, hideEmpty, hideZero, valueType } = this.props;
    const getHoverOptions = { hideEmpty, hideZero, valueType };
    const seriesHoverInfo = getMultiSeriesPlotHoverInfo(series, position, getHoverOptions);
    this.sortHoverInfo(seriesHoverInfo);
    this.seriesHoverInfo = seriesHoverInfo;
    if (allSeriesMode && this.props.onHighlight && this.props.onUnhighlight) {
      this.highlightPoints(seriesHoverInfo);
    }
  }

  render() {
    return (
      <TimeAxisTooltip {...this.props}>
        {(position, item) => {
          this.calculateHoverInfo(position);
          const seriesHoverInfo = this.seriesHoverInfo;
          return this.props.children(this.props.series, item, seriesHoverInfo.time, seriesHoverInfo);
        }}
      </TimeAxisTooltip>
    );
  }
}

export default TimeSeriesTooltip;
