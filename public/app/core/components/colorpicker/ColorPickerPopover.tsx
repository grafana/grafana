///<reference path="../../../headers/common.d.ts" />

import React from 'react';
import $ from 'jquery';
import coreModule from 'app/core/core_module';
import { GfColorPalette } from './ColorPalette';
import { GfSpectrumPicker } from './SpectrumPicker';

// Spectrum picker uses TinyColor and loads it as a global variable, so we can use it here also
declare var tinycolor;

export interface IProps {
  color: string;
  onColorSelect: (c: string) => void;
}

export class ColorPickerPopover extends React.Component<IProps, any> {
  pickerNavElem: any;

  constructor(props) {
    super(props);
    this.state = {
      tab: 'palette',
      color: this.props.color,
      colorString: this.props.color
    };

    this.onColorStringChange = this.onColorStringChange.bind(this);
    this.onColorStringBlur = this.onColorStringBlur.bind(this);
    this.sampleColorSelected = this.sampleColorSelected.bind(this);
    this.spectrumColorSelected = this.spectrumColorSelected.bind(this);
    this.setPickerNavElem = this.setPickerNavElem.bind(this);
  }

  setPickerNavElem(elem) {
    this.pickerNavElem = $(elem);
  }

  setColor(color) {
    let newColor = tinycolor(color);
    if (newColor.isValid()) {
      this.setState({
        color: newColor.toString(),
        colorString: newColor.toString()
      });
      this.props.onColorSelect(color);
    }
  }

  sampleColorSelected(color) {
    this.setColor(color);
  }

  spectrumColorSelected(color) {
    let rgbColor = color.toRgbString();
    this.setColor(rgbColor);
  }

  onColorStringChange(e) {
    let colorString = e.target.value;
    this.setState({
      colorString: colorString
    });

    let newColor = tinycolor(colorString);
    if (newColor.isValid()) {
      // Update only color state
      this.setState({
        color: newColor.toString(),
      });
      this.props.onColorSelect(newColor);
    }
  }

  onColorStringBlur(e) {
    let colorString = e.target.value;
    this.setColor(colorString);
  }

  componentDidMount() {
    this.pickerNavElem.find('li:first').addClass('active');
    this.pickerNavElem.on('show', (e) => {
      // use href attr (#name => name)
      let tab = e.target.hash.slice(1);
      this.setState({
        tab: tab
      });
    });
  }

  render() {
    const paletteTab = (
      <div id="palette">
        <GfColorPalette color={this.state.color} onColorSelect={this.sampleColorSelected} />
      </div>
    );
    const spectrumTab = (
      <div id="spectrum">
        <GfSpectrumPicker color={this.props.color} onColorSelect={this.spectrumColorSelected} options={{}} />
      </div>
    );
    const currentTab = this.state.tab === 'palette' ? paletteTab : spectrumTab;

    return (
      <div className="gf-color-picker">
        <ul className="nav nav-tabs" id="colorpickernav" ref={this.setPickerNavElem}>
          <li className="gf-tabs-item-colorpicker">
            <a href="#palette" data-toggle="tab">Colors</a>
          </li>
          <li className="gf-tabs-item-colorpicker">
            <a href="#spectrum" data-toggle="tab">Spectrum</a>
          </li>
        </ul>
        <div className="colorpicker-container">
          {currentTab}
        </div>
        <div className="color-model-container">
          <input className="gf-form-input" value={this.state.colorString}
            onChange={this.onColorStringChange} onBlur={this.onColorStringBlur}>
          </input>
        </div>
      </div>
    );
  }
}

coreModule.directive('gfColorPickerPopover', function (reactDirective) {
  return reactDirective(ColorPickerPopover, ['color', 'onColorSelect']);
});
