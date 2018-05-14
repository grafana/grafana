import React from 'react';
import _ from 'lodash';

const LINE_PADDING = 13;

export interface IProps {
  index: number;
  threshold: any;
  style?: any;
  yPos: (v: any) => any;
  yPosInvert: (v: any) => any;
  onChange: (v: any) => any;
}

export class ThresholdHandler extends React.Component<IProps, any> {
  handlerElem: any;
  lastY: number;

  constructor(props) {
    super(props);

    const threshold = this.props.threshold;
    const value = threshold.value || 0;
    this.state = {
      value: value || 0,
      dragging: false,
      posTop: this.getYPos(value),
    };

    this.setHandlerRef = this.setHandlerRef.bind(this);
    this.onInitDragging = this.onInitDragging.bind(this);
    this.onStopDragging = this.onStopDragging.bind(this);
    this.onDrag = this.onDrag.bind(this);
  }

  componentDidMount() {
    this.handlerElem.addEventListener('mousedown', this.onInitDragging);
  }

  setHandlerRef(elem) {
    this.handlerElem = elem;
  }

  onInitDragging(evt) {
    this.setState({ dragging: true });
    this.setPositionFromProps();
    this.handlerElem.addEventListener('mousemove', this.onDrag);
    this.handlerElem.addEventListener('mouseup', this.onStopDragging);
    this.handlerElem.addEventListener('mouseleave', this.onStopDragging);
  }

  onDrag(evt) {
    if (!this.state.dragging) {
      return;
    }

    if (this.lastY === null || this.lastY === undefined) {
      this.lastY = evt.clientY;
    } else {
      const diff = evt.clientY - this.lastY;
      const y = this.state.posTop + diff;
      const value = _.round(this.props.yPosInvert(y + LINE_PADDING), 0);
      this.setState({ posTop: y, value: value });
      this.lastY = evt.clientY;
    }
  }

  onStopDragging(evt) {
    this.setState({ dragging: false });
    this.lastY = null;
    this.handlerElem.removeEventListener('mousemove', this.onDrag);
    this.handlerElem.removeEventListener('mouseup', this.onStopDragging);
    this.handlerElem.removeEventListener('mouseleave', this.onStopDragging);
    this.onChange();
  }

  onChange() {
    this.props.onChange(this.state.value);
  }

  getYPos(value) {
    const y = this.props.yPos(value) - LINE_PADDING;
    return y;
  }

  setPositionFromProps() {
    const value = _.toNumber(this.props.threshold.value) || 0;
    const y = this.getYPos(value);
    this.setState({ posTop: y, value: value });
  }

  render() {
    const threshold = this.props.threshold;
    const value = threshold.value || 0;
    const handlerIndex = this.props.index;

    let stateclassName = threshold.colorMode;
    if (threshold.colorMode === 'custom') {
      stateclassName = 'critical';
    }

    const y = this.state.dragging ? this.state.posTop : this.getYPos(value);
    const valueLabel = this.state.dragging ? this.state.value : value;
    const style = _.assign({ top: y }, this.props.style);

    return (
      <div className={`alert-handle-wrapper alert-handle-wrapper--T${handlerIndex}`} style={style}>
        <div className={`alert-handle-line alert-handle-line--${stateclassName}`} />
        <div className="alert-handle" data-handle-index={handlerIndex} ref={this.setHandlerRef}>
          <i className={`icon-gf icon-gf-${stateclassName} alert-state-${stateclassName}`} />
          <span className="alert-handle-value">
            {valueLabel}
            <i className="alert-handle-grip" />
          </span>
        </div>
      </div>
    );
  }
}
