import React from 'react';
import Draggable from 'react-draggable';
import _ from 'lodash';

const LINE_PADDING = 13;
const BOTTOM_PADDING = 20;

export interface IProps {
  index: number;
  threshold: any;
  style?: any;
  yPos: (v: any) => any;
  yPosInvert: (v: any) => any;
  onChange: (v: any) => any;
}

export class ThresholdHandler extends React.Component<IProps, any> {
  thresholdManagerElem: any;

  constructor(props) {
    super(props);

    this.state = {
      value: this.props.threshold.value || 0,
      dragging: false,
    };
  }

  static getDerivedStateFromProps(props, state) {
    // Sync state value if props was changed
    const value = _.toNumber(props.threshold.value) || 0;
    if (state.value !== value) {
      return { value: value };
    } else {
      return null;
    }
  }

  setWrapperRef = elem => {
    if (elem && _.hasIn(elem, 'parentElement.parentElement.parentElement')) {
      this.thresholdManagerElem = elem.parentElement.parentElement.parentElement;
      console.log(this.thresholdManagerElem);
      // When new threshold handler was added, trigger render() to place element in proper position
      // if threshold value is out of Y axis bounds.
      this.forceUpdate();
    }
  };

  onStartDragging = (evt, data) => {
    this.setState({ dragging: true });
  };

  onDrag = (evt, data) => {
    let y = data.y;
    const value = _.round(this.props.yPosInvert(y + LINE_PADDING), 0);
    this.setState({ value: value });
  };

  onStopDragging = evt => {
    this.setState({ dragging: false });
    this.onChange();
  };

  onChange() {
    this.props.onChange(this.state.value);
  }

  getYPos(value) {
    return this.props.yPos(value) - LINE_PADDING;
  }

  /**
   * Limit position of threshold handler element if threshold value is out of Y axis bounds.
   */
  limitYPos(y) {
    y = Math.min(this.getBottomY(), y);
    y = Math.max(0, y);
    return y;
  }

  getBottomY() {
    if (!this.thresholdManagerElem) {
      return +Infinity;
    }
    let thresholdManagerHeight = this.thresholdManagerElem.clientHeight || +Infinity;
    return thresholdManagerHeight - LINE_PADDING - BOTTOM_PADDING;
  }

  getStateClassName(colorMode) {
    const stateclassName = colorMode === 'custom' ? 'critical' : colorMode;
    return stateclassName;
  }

  render() {
    const handlerIndex = this.props.index;
    const threshold = this.props.threshold;
    const stateclassName = this.getStateClassName(threshold.colorMode);
    const value = threshold.value || 0;
    const valueLabel = this.state.dragging ? this.state.value : value;

    let y = this.getYPos(value);
    y = this.limitYPos(y);
    const position = { x: 0, y: y };
    const bounds = {
      top: 0,
      bottom: this.getBottomY(),
      left: 0,
      right: 0,
    };

    return (
      <Draggable
        axis="y"
        handle=".alert-handle"
        position={position}
        bounds={bounds}
        onStart={this.onStartDragging}
        onDrag={this.onDrag}
        onStop={this.onStopDragging}
      >
        <div
          className={`alert-handle-wrapper alert-handle-wrapper--T${handlerIndex}`}
          style={this.props.style}
          ref={this.setWrapperRef}
        >
          <div className={`alert-handle-line alert-handle-line--${stateclassName}`} />
          <div className="alert-handle" data-handle-index={handlerIndex}>
            <i className={`icon-gf icon-gf-${stateclassName} alert-state-${stateclassName}`} />
            <span className="alert-handle-value">
              {valueLabel}
              <i className="alert-handle-grip" />
            </span>
          </div>
        </div>
      </Draggable>
    );
  }
}
