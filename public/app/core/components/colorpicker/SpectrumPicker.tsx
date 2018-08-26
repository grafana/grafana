import React from 'react';
import _ from 'lodash';
import $ from 'jquery';
import 'vendor/spectrum';

export interface Props {
  color: string;
  options: object;
  onColorSelect: (c: string) => void;
}

export class SpectrumPicker extends React.Component<Props, any> {
  elem: any;
  isMoving: boolean;

  constructor(props) {
    super(props);
    this.onSpectrumMove = this.onSpectrumMove.bind(this);
    this.setComponentElem = this.setComponentElem.bind(this);
  }

  setComponentElem(elem) {
    this.elem = $(elem);
  }

  onSpectrumMove(color) {
    this.isMoving = true;
    this.props.onColorSelect(color);
  }

  componentDidMount() {
    const spectrumOptions = _.assignIn(
      {
        flat: true,
        showAlpha: true,
        showButtons: false,
        color: this.props.color,
        appendTo: this.elem,
        move: this.onSpectrumMove,
      },
      this.props.options
    );

    this.elem.spectrum(spectrumOptions);
    this.elem.spectrum('show');
    this.elem.spectrum('set', this.props.color);
  }

  componentWillUpdate(nextProps) {
    // If user move pointer over spectrum field this produce 'move' event and component
    // may update props.color. We don't want to update spectrum color in this case, so we can use
    // isMoving flag for tracking moving state. Flag should be cleared in componentDidUpdate() which
    // is called after updating occurs (when user finished moving).
    if (!this.isMoving) {
      this.elem.spectrum('set', nextProps.color);
    }
  }

  componentDidUpdate() {
    if (this.isMoving) {
      this.isMoving = false;
    }
  }

  componentWillUnmount() {
    this.elem.spectrum('destroy');
  }

  render() {
    return <div className="spectrum-container" ref={this.setComponentElem} />;
  }
}
