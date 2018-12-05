import React, { PureComponent } from 'react';
import { TimeSeriesVM } from 'app/types';
import { Subtract } from 'app/types/utils';
import { getMultiSeriesPlotHoverInfo, PlotHoverInfo } from './utils';
import withTimeAxisTooltip, { InjectedTimeAxisTooltipProps } from './TimeAxisTooltip';
import { FlotHoverItem } from 'app/types/events';

export interface TimeSeriesTooltipProps extends InjectedTimeAxisTooltipProps {
  series: TimeSeriesVM[];
  allSeriesMode?: boolean;
  hideEmpty?: boolean;
  hideZero?: boolean;
  valueType?: 'individual' | 'cumulative';
  sort?: 1 | 2 | null;
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
      // Dynamically reorder the hovercard for the current time point if the
      // option is enabled.
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

      const getHoverOptions = { hideEmpty, hideZero, valueType };
      const seriesHoverInfo = getMultiSeriesPlotHoverInfo(series, position, getHoverOptions);
      this.sortHoverInfo(seriesHoverInfo);
      if (allSeriesMode && this.props.onHighlight && this.props.onUnhighlight) {
        this.highlightPoints(seriesHoverInfo);
      }

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
