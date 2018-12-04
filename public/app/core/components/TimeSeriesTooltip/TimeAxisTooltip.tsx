import React, { PureComponent, CSSProperties } from 'react';
import ReactDOM from 'react-dom';
import { GraphHoverPosition, GraphHoverEvent, FlotPosition, FlotHoverItem } from 'app/types/events';
import { Subtract } from 'app/types/utils';
import { appEvents } from 'app/core/core';

const TOOLTIP_OFFSET = 20;

export interface TimeAxisTooltipProps {
  chartElem: any;
  panelId: number;
  sharedTooltip?: boolean;
  /** Event which tooltip is showing on. Default is 'plothover' */
  hoverEvent?: string;
  /** Use CSS transform: translate() for positioning tooltip. If false, top/left will be used instead. */
  useCSSTransforms?: boolean;
  formatDate: (time, format?) => string;
  /** Function converting timestamp into offset on chart */
  getOffset: (x) => number;
  onMouseleave?: (event?) => void;
}

export interface TimeAxisTooltipState {
  show: boolean;
  position?: GraphHoverPosition;
  tooltipPosition?: { x: number; y: number };
  item?: FlotHoverItem;
}

const defaultPosition: GraphHoverPosition = {
  pageX: 0,
  pageY: 0,
  x: 0,
  y: 0,
};

export interface InjectedTimeAxisTooltipProps {
  position: GraphHoverPosition;
  item?: FlotHoverItem;
}

interface TooltipSize {
  width: number;
  height: number;
}

const withTimeAxisTooltip = <P extends InjectedTimeAxisTooltipProps>(WrappedComponent: React.ComponentType<P>) => {
  return class TimeAxisTooltip extends PureComponent<
    Subtract<P, InjectedTimeAxisTooltipProps> & TimeAxisTooltipProps,
    TimeAxisTooltipState
  > {
    appRoot: HTMLElement;
    tooltipContainer: HTMLElement;
    tooltipElem: HTMLElement;
    size: TooltipSize;

    static defaultProps: Partial<TimeAxisTooltipProps> = {
      hoverEvent: 'plothover',
      useCSSTransforms: true,
      sharedTooltip: false,
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
      appEvents.on('graph-hover-clear', this.handleHoverClear);
    }

    unbindEvents() {
      this.props.chartElem.off(this.props.hoverEvent);
      this.props.chartElem.off('mouseleave');
      appEvents.off('graph-hover', this.handleGraphHoverEvent);
      appEvents.off('graph-hover-clear', this.handleHoverClear);
    }

    handleHoverEvent = (event, position: FlotPosition, item: FlotHoverItem) => {
      this.show(position, item);
    };

    handleGraphHoverEvent = (event: GraphHoverEvent) => {
      // ignore if we are the emitter
      if (!this.props.sharedTooltip || this.props.panelId === event.panel.id) {
        return;
      }
      const position = { ...event.pos };
      const elemOffset = this.getElemOffset();
      position.pageX = this.props.getOffset(position.x) + elemOffset.left;
      // console.log(event.pos.pageX);
      this.show(position);
    };

    handleMouseleave = event => {
      this.hide();
      this.props.onMouseleave(event);
    };

    handleHoverClear = () => {
      this.hide();
    };

    show(position: GraphHoverPosition, item?: FlotHoverItem) {
      const tooltipPosition = this.calculatePosition(this.state.position);
      if (tooltipPosition.x < 0 || tooltipPosition.y < 0) {
        this.setState({ show: false });
      }
      this.setState({
        show: true,
        position: position,
        tooltipPosition: tooltipPosition,
        item: item,
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
      const tooltipSize = this.size || this.getTooltipSize();

      // Restrict tooltip position
      let x = hoverEventPos.pageX + TOOLTIP_OFFSET;
      if (x + tooltipSize.width > elemWidth + elemOffset.left) {
        x = elemWidth + elemOffset.left - tooltipSize.width;
      }
      if (x < elemOffset.left) {
        x = elemOffset.left;
      }

      let y = elemHeight + elemOffset.top;
      const appRootHeight = this.getAppRootHeight();
      if (y + tooltipSize.height > appRootHeight) {
        y = tooltipSize.height ? appRootHeight - tooltipSize.height : 0;
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
      if (!this.size) {
        // Hide tooltip on its initial position (it cannot be calculated properly due to tooltip size equals 0)
        tooltipStyle.opacity = 0;
      }

      const tooltipNode = (
        <div className="graph-tooltip grafana-tooltip timeseries-tooltip" style={tooltipStyle} ref={this.getTooltipRef}>
          <WrappedComponent position={this.state.position} item={this.state.item} {...this.props} />
        </div>
      );
      return ReactDOM.createPortal(tooltipNode, this.tooltipContainer);
    }
  };
};

export default withTimeAxisTooltip;
