import React, { PureComponent } from 'react';
import { TimeSeriesVM } from 'app/types';
import { Subtract } from 'app/types/utils';
import { GraphHoverPosition } from 'app/types/events';
import { getMultiSeriesPlotHoverInfo } from './utils';
import withTimeAxisTooltip, { TimeAxisTooltipProps } from './TimeAxisTooltip';

export interface TimeSeriesTooltipProps extends TimeAxisTooltipProps {
  series: TimeSeriesVM[];
  panelOptions?: PanelOptions;
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

    render() {
      const { position, ...props } = this.props as any;
      const panelOptions = {
        hideEmpty: this.props.panelOptions.legend.hideEmpty,
        hideZero: this.props.panelOptions.legend.hideZero,
        tooltipValueType: this.props.panelOptions.tooltip.value_type,
      };
      const seriesHoverInfo = getMultiSeriesPlotHoverInfo(props.series, position, panelOptions);
      return <WrappedComponent position={position} timestamp={seriesHoverInfo.time} {...props} />;
    }
  }

  return withTimeAxisTooltip(TimeSeriesTooltip);
};

export default withTimeSeriesTooltip;
