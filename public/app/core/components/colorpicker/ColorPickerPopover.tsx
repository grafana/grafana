import React from 'react';
import $ from 'jquery';
import tinycolor from 'tinycolor2';
import { ColorPalette } from './ColorPalette';
import { SpectrumPicker } from './SpectrumPicker';

const DEFAULT_COLOR = '#000000';

export interface Props {
  color: string;
  onColorSelect: (c: string) => void;
}

export class ColorPickerPopover extends React.Component<Props, any> {
  pickerNavElem: any;

  constructor(props) {
    super(props);
    this.state = {
      tab: 'palette',
      color: this.props.color || DEFAULT_COLOR,
      colorString: this.props.color || DEFAULT_COLOR,
    };
  }

  setPickerNavElem(elem) {
    this.pickerNavElem = $(elem);
  }

  setColor(color) {
    const newColor = tinycolor(color);
    if (newColor.isValid()) {
      this.setState({
        color: newColor.toString(),
        colorString: newColor.toString(),
      });
      this.props.onColorSelect(color);
    }
  }

  sampleColorSelected(color) {
    this.setColor(color);
  }

  spectrumColorSelected(color) {
    const rgbColor = color.toRgbString();
    this.setColor(rgbColor);
  }

  onColorStringChange(e) {
    const colorString = e.target.value;
    this.setState({
      colorString: colorString,
    });

    const newColor = tinycolor(colorString);
    if (newColor.isValid()) {
      // Update only color state
      const newColorString = newColor.toString();
      this.setState({
        color: newColorString,
      });
      this.props.onColorSelect(newColorString);
    }
  }

  onColorStringBlur(e) {
    const colorString = e.target.value;
    this.setColor(colorString);
  }

  componentDidMount() {
    this.pickerNavElem.find('li:first').addClass('active');
    this.pickerNavElem.on('show', e => {
      // use href attr (#name => name)
      const tab = e.target.hash.slice(1);
      this.setState({
        tab: tab,
      });
    });
  }

  render() {
    const paletteTab = (
      <div id="palette">
        <ColorPalette color={this.state.color} onColorSelect={this.sampleColorSelected.bind(this)} />
      </div>
    );
    const spectrumTab = (
      <div id="spectrum">
        <SpectrumPicker color={this.state.color} onColorSelect={this.spectrumColorSelected.bind(this)} options={{}} />
      </div>
    );
    const currentTab = this.state.tab === 'palette' ? paletteTab : spectrumTab;

    return (
      <div className="gf-color-picker">
        <ul className="nav nav-tabs" id="colorpickernav" ref={this.setPickerNavElem.bind(this)}>
          <li className="gf-tabs-item-colorpicker">
            <a href="#palette" data-toggle="tab">
              Colors
            </a>
          </li>
          <li className="gf-tabs-item-colorpicker">
            <a href="#spectrum" data-toggle="tab">
              Custom
            </a>
          </li>
        </ul>
        <div className="gf-color-picker__body">{currentTab}</div>
        <div>
          <input
            className="gf-form-input gf-form-input--small"
            value={this.state.colorString}
            onChange={this.onColorStringChange.bind(this)}
            onBlur={this.onColorStringBlur.bind(this)}
          />
        </div>
      </div>
    );
  }
}
