import React, { PureComponent, ReactNode, CSSProperties } from 'react';
import ReactDOM from 'react-dom';
import { appEvents } from 'app/core/core';
import { GraphHoverPosition, GraphHoverEvent, FlotPosition, FlotHoverItem } from 'app/types/events';

const TOOLTIP_OFFSET = 20;
/**
 * Interval which determines how often tooltip fires content rendering.
 * Since component render is expensive operation, it makes sense to call it only with a reasonable interval.
 * Inside this interval, tooltip is only moving and do not re-renders content.
 */
const TOOLTIP_RENDER_INTERVAL = 60;

export interface TimeAxisTooltipProps {
  chartElem: any;
  panelId: number;
  sharedTooltip?: boolean;
  /** Event which tooltip is showing on. Default is 'plothover' */
  hoverEvent?: string;
  /** Use CSS transform: translate() for positioning tooltip. If false, top/left will be used instead. */
  useCSSTransforms?: boolean;
  renderInterval?: number;
  /** Function converting timestamp into offset on chart */
  getOffset: (x) => number;
  onMouseleave?: (event?) => void;
}

interface TimeAxisTooltipRenderProps {
  children: (position: GraphHoverPosition, item: FlotHoverItem) => ReactNode;
}

export interface TimeAxisTooltipState {
  show: boolean;
  position?: GraphHoverPosition;
  tooltipPosition?: { x: number; y: number };
  item?: FlotHoverItem;
}

export interface InjectedTimeAxisTooltipProps {
  position: GraphHoverPosition;
  item: FlotHoverItem;
}

interface TooltipSize {
  width: number;
  height: number;
}

interface ElementOffset {
  left: number;
  top: number;
}

const defaultPosition: GraphHoverPosition = {
  pageX: 0,
  pageY: 0,
  x: 0,
  y: 0,
};

type ComponentProps = TimeAxisTooltipProps & TimeAxisTooltipRenderProps;

export class TimeAxisTooltip extends PureComponent<ComponentProps, TimeAxisTooltipState> {
  appRoot: HTMLElement;
  tooltipContainer: HTMLElement;
  tooltipElem: HTMLElement;
  size: TooltipSize;
  elemHeight: number;
  elemWidth: number;
  elemOffset: ElementOffset;
  lastRenderTS: number;

  static defaultProps: Partial<TimeAxisTooltipProps> = {
    hoverEvent: 'plothover',
    useCSSTransforms: true,
    sharedTooltip: false,
    renderInterval: TOOLTIP_RENDER_INTERVAL,
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
    this.lastRenderTS = performance.now();
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
    const interval = performance.now() - this.lastRenderTS;
    const shouldUpdate = interval > this.props.renderInterval;
    const tooltipPosition = this.calculatePosition(position, shouldUpdate);
    if (tooltipPosition.x < 0 || tooltipPosition.y < 0) {
      return this.setState({ show: false });
    }
    requestAnimationFrame(() => {
      this.tooltipElem.style.transform = `translate(${tooltipPosition.x}px, ${tooltipPosition.y}px)`;
    });
    // Calling setState() causes component render. So it makes sense to do not re-render component
    // on every mousemove event, but limit it to TOOLTIP_RENDER_INTERVAL and move tooltip inside this
    // interval by changing CSS styles directly. This makes tooltip movement smoother, especially on
    // large dashboards with shared tooltip enabled.
    if (shouldUpdate || !this.state.show) {
      this.lastRenderTS = performance.now();
      this.setState({
        show: true,
        position: position,
        tooltipPosition: tooltipPosition,
        item: item,
      });
    }
  }

  hide() {
    this.setState({ show: false });
  }

  calculatePosition(hoverEventPos: GraphHoverPosition, update = false): { x: number; y: number } {
    const elemHeight = this.getElemHeight(update);
    const elemWidth = this.getElemWidth(update);
    const elemOffset = this.getElemOffset(update);
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

  getElemWidth(update = false) {
    if (!this.elemWidth || update) {
      this.elemWidth = (this.props.chartElem && this.props.chartElem[0].clientWidth) || 0;
    }
    return this.elemWidth;
  }

  getElemHeight(update = false) {
    if (!this.elemHeight || update) {
      this.elemHeight = (this.props.chartElem && this.props.chartElem[0].clientHeight) || 0;
    }
    return this.elemHeight;
  }

  getElemOffset(update = false): ElementOffset {
    // TODO: make it working for both JQuery and HTML elements
    if (!this.elemOffset || update) {
      this.elemOffset = (this.props.chartElem && this.props.chartElem.offset()) || { left: 0, top: 0 };
    }
    return this.elemOffset;
  }

  isElemHidden(): boolean {
    const { chartElem } = this.props;
    if (chartElem && chartElem[0]) {
      return chartElem[0].clientWidth === 0 || chartElem[0].clientHeight === 0;
    }
    return false;
  }

  render() {
    const tooltipStyle: CSSProperties = {};
    if (!this.state.show) {
      tooltipStyle.display = 'none';
    }
    if (!this.size) {
      // Hide tooltip on its initial position (it cannot be calculated properly due to tooltip size equals 0)
      tooltipStyle.opacity = 0;
    }

    const tooltipNode = (
      <div className="graph-tooltip grafana-tooltip timeseries-tooltip" style={tooltipStyle} ref={this.getTooltipRef}>
        {this.props.children(this.state.position, this.state.item)}
      </div>
    );
    return ReactDOM.createPortal(tooltipNode, this.tooltipContainer);
  }
}

export default TimeAxisTooltip;
