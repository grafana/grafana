import React, { PureComponent, ReactNode, CSSProperties } from 'react';
import ReactDOM from 'react-dom';
import { appEvents } from 'app/core/core';
import { GraphHoverPosition, GraphHoverEvent, FlotPosition, FlotHoverItem } from 'app/types/events';
// import { Subtract } from 'app/types/utils';

const TOOLTIP_OFFSET = 20;

export interface TimeAxisTooltipProps {
  chartElem: any;
  panelId: number;
  sharedTooltip?: boolean;
  /** Event which tooltip is showing on. Default is 'plothover' */
  hoverEvent?: string;
  /** Use CSS transform: translate() for positioning tooltip. If false, top/left will be used instead. */
  useCSSTransforms?: boolean;
  /** Function converting timestamp into offset on chart */
  getOffset: (x) => number;
  onMouseleave?: (event?) => void;
}

interface TimeAxisTooltipRenderProps {
  render: (position: GraphHoverPosition, item: FlotHoverItem) => ReactNode;
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
  item: FlotHoverItem;
}

interface TooltipSize {
  width: number;
  height: number;
}

/**
 * Finally, withTimeAxisTooltip(WrappedComponent) should have all props that TimeAxisTooltip has and props passed into
 * WrappedComponent, but without injected props.
 */
// export type WithTimeAxisTooltipProps<P> = Subtract<P, InjectedTimeAxisTooltipProps> & TimeAxisTooltipProps;

class TimeAxisTooltip extends PureComponent<TimeAxisTooltipProps & TimeAxisTooltipRenderProps, TimeAxisTooltipState> {
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

  handleHoverEvent = (event, position: FlotPosition, item?: FlotHoverItem) => {
    this.show(position, item);
  };

  handleGraphHoverEvent = (event: GraphHoverEvent) => {
    // ignore if we are the emitter
    if (!this.props.sharedTooltip || this.props.panelId === event.panel.id || this.isElemHidden()) {
      return;
    }
    const position = { ...event.pos };
    const elemOffset = this.getElemOffset();
    position.pageX = this.props.getOffset(position.x) + elemOffset.left;
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

  isElemHidden(): boolean {
    const { chartElem } = this.props;
    if (chartElem && chartElem[0]) {
      return chartElem[0].clientWidth === 0 || chartElem[0].clientHeight === 0;
    }
    return false;
  }

  render() {
    const tooltipPos = this.state.tooltipPosition;
    let tooltipStyle: CSSProperties;
    if (this.props.useCSSTransforms) {
      tooltipStyle = { transform: `translate(${tooltipPos.x}px, ${tooltipPos.y}px)` };
    } else {
      tooltipStyle = { left: tooltipPos.x, top: tooltipPos.y };
    }
    if (!this.state.show) {
      tooltipStyle.display = 'none';
    }
    if (!this.size) {
      // Hide tooltip on its initial position (it cannot be calculated properly due to tooltip size equals 0)
      tooltipStyle.opacity = 0;
    }

    const tooltipNode = (
      <div className="graph-tooltip grafana-tooltip timeseries-tooltip" style={tooltipStyle} ref={this.getTooltipRef}>
        {this.props.render(this.state.position, this.state.item)}
      </div>
    );
    return ReactDOM.createPortal(tooltipNode, this.tooltipContainer);
  }
}

export default TimeAxisTooltip;
