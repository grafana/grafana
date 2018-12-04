import React, { PureComponent } from 'react';
import { TimeSeriesVM } from 'app/types';
import { Subtract } from 'app/types/utils';
import { GraphHoverPosition } from 'app/types/events';
import { getMultiSeriesPlotHoverInfo, PlotHoverInfo } from './utils';
import withTimeAxisTooltip, { TimeAxisTooltipProps } from './TimeAxisTooltip';

export interface TimeSeriesTooltipProps extends TimeAxisTooltipProps {
  series: TimeSeriesVM[];
  panelOptions?: PanelOptions;
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
}

interface PanelOptions {
  legend?: {
    hideEmpty?: boolean;
    hideZero?: boolean;
  };
  tooltip?: {
    value_type?: string;
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

    render() {
      const { position, ...props } = this.props as any;
      const panelOptions = {
        hideEmpty: this.props.panelOptions.legend.hideEmpty,
        hideZero: this.props.panelOptions.legend.hideZero,
        tooltipValueType: this.props.panelOptions.tooltip.value_type,
      };
      const seriesHoverInfo = getMultiSeriesPlotHoverInfo(props.series, position, panelOptions);
      // console.log(props.series);
      if (this.props.onHighlight && this.props.onUnhighlight) {
        this.highlightPoints(seriesHoverInfo);
      }
      return <WrappedComponent position={position} timestamp={seriesHoverInfo.time} {...props} />;
    }
  }

  return withTimeAxisTooltip(TimeSeriesTooltip);
};

export default withTimeSeriesTooltip;
