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
    onHighlight: () => {},
    onUnhighlight: () => {},
  };

  constructor(props) {
    super(props);
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
    const { series, hideEmpty, hideZero, valueType } = this.props;
    const getHoverOptions = { hideEmpty, hideZero, valueType };
    const seriesHoverInfo = getMultiSeriesPlotHoverInfo(series, position, getHoverOptions);
    this.sortHoverInfo(seriesHoverInfo);
    return seriesHoverInfo;
  }

  renderChildren = (position, item) => {
    const { allSeriesMode, onHighlight, onUnhighlight } = this.props;
    const seriesHoverInfo = this.getHoverInfo(position);
    if (allSeriesMode && onHighlight && onUnhighlight) {
      this.highlightPoints(seriesHoverInfo);
    }
    return this.props.children(this.props.series, item, seriesHoverInfo.time, seriesHoverInfo);
  };

  render() {
    return <TimeAxisTooltip {...this.props}>{this.renderChildren}</TimeAxisTooltip>;
  }
}

export default TimeSeriesTooltip;
