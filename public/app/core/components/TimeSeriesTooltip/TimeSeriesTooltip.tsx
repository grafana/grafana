import React, { PureComponent, CSSProperties } from 'react';
import ReactDOM from 'react-dom';
import { TimeSeriesVM } from 'app/types';
import { GraphHoverPosition, GraphHoverEvent, FlotPosition } from 'app/types/events';
import { appEvents } from 'app/core/core';
import { getMultiSeriesPlotHoverInfo } from './utils';

export interface TimeSeriesTooltipProps {
  series: TimeSeriesVM[];
  chartElem: any;
  panelId: number;
  panelOptions?: PanelOptions;
  showSharedTooltip?: boolean;
  dateFormat: (time, format) => string;
  /** Function converting timestamp into offset on chart */
  getOffset: (x) => number;
  hoverEvent?: string;
  useCSSTransforms?: boolean;
}

export interface TimeSeriesTooltipState {
  show: boolean;
  position?: GraphHoverPosition;
  tooltipPosition?: { x: number; y: number };
}

const defaultPosition: GraphHoverPosition = {
  pageX: 0,
  pageY: 0,
  x: 0,
  y: 0,
};

export interface InjectedTooltipProps {
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

interface TooltipSize {
  width: number;
  height: number;
}

const withTimeSeriesTooltip = <P extends InjectedTooltipProps>(WrappedComponent: React.ComponentType<P>) => {
  return class TimeSeriesTooltip extends PureComponent<TimeSeriesTooltipProps, TimeSeriesTooltipState> {
    appRoot: HTMLElement;
    tooltipContainer: HTMLElement;
    tooltipElem: HTMLElement;
    size: TooltipSize;

    static defaultProps: Partial<TimeSeriesTooltipProps> = {
      hoverEvent: 'plothover',
      useCSSTransforms: true,
      showSharedTooltip: false,
      panelOptions: {
        legend: {},
        tooltip: {},
      },
    };

    constructor(props) {
      super(props);

      this.state = {
        show: false,
        position: defaultPosition,
        tooltipPosition: { x: 0, y: 0 },
      };

      this.appRoot = document.body;
      this.tooltipContainer = document.body;
    }

    getTooltipRef = ref => {
      this.tooltipElem = ref;
    };

    componentDidMount() {
      // this.appRoot = document.getElementsByClassName('dashboard-container')[0];
      this.bindEvents();
    }

    componentWillUnmount() {
      this.unbindEvents();
    }

    bindEvents() {
      this.props.chartElem.on(this.props.hoverEvent, this.handleHoverEvent);
      this.props.chartElem.on('mouseleave', this.handleMouseleave);
      appEvents.on('graph-hover', this.handleGraphHoverEvent);
      appEvents.on('graph-hover-clear', this.handleMouseleave);
    }

    unbindEvents() {
      this.props.chartElem.off(this.props.hoverEvent);
      this.props.chartElem.off('mouseleave');
      appEvents.off('graph-hover', this.handleGraphHoverEvent);
      appEvents.off('graph-hover-clear', this.handleMouseleave);
    }

    handleHoverEvent = (event, position: FlotPosition, item) => {
      // console.log(position);
      this.show(position);
    };

    handleGraphHoverEvent = (event: GraphHoverEvent) => {
      // ignore if we are the emitter
      if (!this.props.showSharedTooltip || this.props.panelId === event.panel.id) {
        return;
      }
      const position = { ...event.pos };
      const elemOffset = this.getElemOffset();
      position.pageX = this.props.getOffset(position.x) + elemOffset.left;
      // console.log(event.pos.pageX);
      this.show(position);
    };

    handleMouseleave = () => {
      this.hide();
    };

    show(position: GraphHoverPosition) {
      const tooltipPosition = this.calculatePosition(this.state.position);
      if (tooltipPosition.x < 0 || tooltipPosition.y < 0) {
        this.setState({ show: false });
      }
      this.setState({
        show: true,
        position: position,
        tooltipPosition: tooltipPosition,
      });
    }

    hide() {
      this.setState({ show: false });
    }

    calculatePosition(hoverEventPos: GraphHoverPosition): { x: number; y: number } {
      const elemHeight = this.props.chartElem[0].clientHeight;
      const elemWidth = this.props.chartElem[0].clientWidth;
      const elemOffset = this.getElemOffset();
      // const positionOffset = this.props.getOffset(hoverEventPos.x);
      // console.log(hoverEventPos.x, positionOffset);
      const tooltipSize = this.size || this.getTooltipSize();

      // Restrict tooltip position
      let x = hoverEventPos.pageX;
      if (x + tooltipSize.width > elemWidth + elemOffset.left) {
        x = elemWidth + elemOffset.left - tooltipSize.width;
      }
      if (x < elemOffset.left) {
        x = elemOffset.left;
      }

      let y = elemHeight + elemOffset.top;
      const appRootHeight = this.getAppRootHeight();
      if (y + tooltipSize.height > appRootHeight) {
        y = appRootHeight - tooltipSize.height;
      }

      // Make some CPU throttling
      // for (let index = 0; index < 5000000; index++) {
      //   Math.sqrt(Math.random());
      // }

      return { x, y };
    }

    getTooltipSize(): TooltipSize {
      const size = {
        width: this.tooltipElem && this.tooltipElem.clientWidth,
        height: this.tooltipElem && this.tooltipElem.clientHeight,
      };
      if (size.height && size.width) {
        this.size = size;
      }
      return {
        width: size.width || 0,
        height: size.height || 0,
      };
    }

    getAppRootHeight() {
      return (this.appRoot && this.appRoot.clientHeight) || 0;
    }

    getElemOffset(): { left: number; top: number } {
      // TODO: make it working for both JQuery and HTML elements
      const offset = this.props.chartElem.offset();
      return offset;
    }

    render() {
      const tooltipPos = this.state.tooltipPosition;
      const tooltipStyle: CSSProperties = this.props.useCSSTransforms
        ? {
            transform: `translate(${tooltipPos.x}px, ${tooltipPos.y}px)`,
          }
        : {
            left: tooltipPos.x,
            top: tooltipPos.y,
          };

      if (!this.state.show) {
        tooltipStyle.display = 'none';
      }

      const panelOptions = {
        hideEmpty: this.props.panelOptions.legend.hideEmpty,
        hideZero: this.props.panelOptions.legend.hideZero,
        tooltipValueType: this.props.panelOptions.tooltip.value_type,
      };
      const seriesHoverInfo = getMultiSeriesPlotHoverInfo(this.props.series, this.state.position, panelOptions);
      // console.log(seriesHoverInfo);

      const tooltipNode = (
        <div className="graph-tooltip grafana-tooltip timeseries-tooltip" style={tooltipStyle} ref={this.getTooltipRef}>
          <WrappedComponent timestamp={seriesHoverInfo.time} {...this.props} />
        </div>
      );
      return ReactDOM.createPortal(tooltipNode, this.tooltipContainer);
    }
  };
};

export default withTimeSeriesTooltip;
