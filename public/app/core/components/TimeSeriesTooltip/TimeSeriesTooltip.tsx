import _ from 'lodash';
import React, { PureComponent } from 'react';
import { TimeSeriesVM } from 'app/types';
import { FlotHoverItem } from 'app/types/events';
import { Subtract } from 'app/types/utils';
import { getMultiSeriesPlotHoverInfo, PlotHoverInfo } from './utils';
import withTimeAxisTooltip, { InjectedTimeAxisTooltipProps } from './TimeAxisTooltip';

export interface TimeSeriesTooltipProps extends InjectedTimeAxisTooltipProps {
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

export interface InjectedTimeSeriesTooltipProps {
  series: TimeSeriesVM[];
  item: FlotHoverItem;
  timestamp: number;
  hoverInfo: PlotHoverInfo;
}

/**
 * withTimeSeriesTooltip(WrappedComponent) should have all props that TimeSeriesTooltip has and props passed into
 * WrappedComponent, but without injected props.
 */
export type WithTimeSeriesTooltipProps<P> = Subtract<P, InjectedTimeSeriesTooltipProps> & TimeSeriesTooltipProps;

const withTimeSeriesTooltip = <P extends InjectedTimeSeriesTooltipProps>(WrappedComponent: React.ComponentType<P>) => {
  class TimeSeriesTooltip extends PureComponent<WithTimeSeriesTooltipProps<P>> {
    seriesHoverInfo: PlotHoverInfo | null;
    calculateHoverInfo: () => void;

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
        this.calculateHoverInfo = _.throttle(() => this.getHoverInfo(), this.props.throttleInterval, { leading: true });
      } else {
        this.calculateHoverInfo = () => this.getHoverInfo();
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

    getHoverInfo() {
      const { series, position, allSeriesMode, hideEmpty, hideZero, valueType } = this.props;
      const getHoverOptions = { hideEmpty, hideZero, valueType };
      const seriesHoverInfo = getMultiSeriesPlotHoverInfo(series, position, getHoverOptions);
      this.sortHoverInfo(seriesHoverInfo);
      this.seriesHoverInfo = seriesHoverInfo;
      if (allSeriesMode && this.props.onHighlight && this.props.onUnhighlight) {
        this.highlightPoints(seriesHoverInfo);
      }
    }

    render() {
      // Cut the own component props and pass through the rest.
      const {
        position,
        allSeriesMode,
        sort,
        valueType,
        hideEmpty,
        hideZero,
        onHighlight,
        onUnhighlight,
        item,
        series,
        ...passThroughProps
      } = this.props as TimeSeriesTooltipProps;

      this.calculateHoverInfo();
      const seriesHoverInfo = this.seriesHoverInfo;

      return (
        <WrappedComponent
          series={series}
          item={item}
          timestamp={seriesHoverInfo.time}
          hoverInfo={seriesHoverInfo}
          {...passThroughProps}
        />
      );
    }
  }

  return withTimeAxisTooltip(TimeSeriesTooltip);
};

export default withTimeSeriesTooltip;
