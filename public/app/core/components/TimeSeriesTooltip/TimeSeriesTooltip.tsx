import React, { PureComponent } from 'react';
import { TimeSeriesVM } from 'app/types';
import { Subtract } from 'app/types/utils';
import { GraphHoverPosition } from 'app/types/events';
import { getMultiSeriesPlotHoverInfo, PlotHoverInfo } from './utils';
import withTimeAxisTooltip, { TimeAxisTooltipProps } from './TimeAxisTooltip';

export interface TimeSeriesTooltipProps extends TimeAxisTooltipProps {
  series: TimeSeriesVM[];
  panelOptions?: PanelOptions;
  allSeriesMode?: boolean;
  sort?: 1 | 2 | null;
  onHighlight?: (series, datapoint) => void;
  onUnhighlight?: () => void;
}

export interface TimeSeriesTooltipState {
  show: boolean;
  position?: GraphHoverPosition;
  tooltipPosition?: { x: number; y: number };
}

export interface InjectedTimeSeriesTooltipProps {
  timestamp: number;
  hoverInfo: PlotHoverInfo;
}

interface PanelOptions {
  legend?: {
    hideEmpty?: boolean;
    hideZero?: boolean;
  };
  tooltip?: {
    value_type?: string;
    shared?: boolean;
  };
}

const withTimeSeriesTooltip = <P extends InjectedTimeSeriesTooltipProps>(WrappedComponent: React.ComponentType<P>) => {
  class TimeSeriesTooltip extends PureComponent<
    Subtract<P, InjectedTimeSeriesTooltipProps> & TimeSeriesTooltipProps,
    TimeSeriesTooltipState
  > {
    static defaultProps: Partial<TimeSeriesTooltipProps> = {
      panelOptions: {
        legend: {},
        tooltip: {},
      },
    };

    constructor(props) {
      super(props);
    }

    highlightPoints(seriesHoverInfo: PlotHoverInfo) {
      const { series } = this.props;
      this.props.onUnhighlight();
      for (let i = 0; i < series.length; i++) {
        const hoverInfo = seriesHoverInfo[i];
        this.props.onHighlight(hoverInfo.index, hoverInfo.hoverIndex);
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
      const { position, ...props } = this.props as any;
      const { panelOptions, allSeriesMode } = props as TimeSeriesTooltipProps;
      const getHoverOptions = {
        hideEmpty: panelOptions.legend.hideEmpty,
        hideZero: panelOptions.legend.hideZero,
        tooltipValueType: panelOptions.tooltip.value_type,
      };
      const seriesHoverInfo = getMultiSeriesPlotHoverInfo(props.series, position, getHoverOptions);
      this.sortHoverInfo(seriesHoverInfo);
      if (allSeriesMode && this.props.onHighlight && this.props.onUnhighlight) {
        this.highlightPoints(seriesHoverInfo);
      }
      return (
        <WrappedComponent position={position} timestamp={seriesHoverInfo.time} hoverInfo={seriesHoverInfo} {...props} />
      );
    }
  }

  return withTimeAxisTooltip(TimeSeriesTooltip);
};

export default withTimeSeriesTooltip;
