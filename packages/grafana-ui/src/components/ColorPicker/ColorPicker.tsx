import React, { Component, createRef } from 'react';
import PopperController from '../Tooltip/PopperController';
import Popper from '../Tooltip/Popper';
import { ColorPickerPopover } from './ColorPickerPopover';
import { Themeable } from '../../types';

export interface ColorPickerProps {
  color: string;
  onChange: (color: string) => void;
}

export class ColorPicker extends Component<ColorPickerProps & Themeable, any> {
  private pickerTriggerRef = createRef<HTMLDivElement>();

  render() {
    return (
      <PopperController content={<ColorPickerPopover {...this.props} />}>
        {(showPopper, hidePopper, popperProps) => {
          return (
            <>
              {this.pickerTriggerRef.current && (
                <Popper {...popperProps} referenceElement={this.pickerTriggerRef.current} className="ColorPicker" />
              )}
              <div ref={this.pickerTriggerRef} onClick={showPopper} className="sp-replacer sp-light">
                <div className="sp-preview">
                  <div className="sp-preview-inner" style={{ backgroundColor: this.props.color }} />
                </div>
              </div>
            </>
          );
        }}
      </PopperController>
    );
  }
}

export default ColorPicker;
