import React, { Component, createRef } from 'react';
import PopperController from '../Tooltip/PopperController';
import Popper from '../Tooltip/Popper';
import { ColorPickerPopover } from './ColorPickerPopover';
import { Themeable, GrafanaTheme } from '../../types';

export interface ColorPickerProps extends Themeable {
  color: string;
  onChange: (color: string) => void;
}

export class ColorPicker extends Component<ColorPickerProps & Themeable, any> {
  private pickerTriggerRef = createRef<HTMLDivElement>();

  render() {
    const { theme } = this.props;
    return (
      <PopperController placement="bottom-start"  content={<ColorPickerPopover {...this.props} />}>
        {(showPopper, hidePopper, popperProps) => {
          return (
            <>
              {this.pickerTriggerRef.current && (
                <Popper
                  {...popperProps}
                  referenceElement={this.pickerTriggerRef.current}
                  className="ColorPicker"
                  renderArrow={({ arrowProps, placement }) => {
                    return (
                      <div
                        {...arrowProps}
                        data-placement={placement}
                        className={`ColorPicker__arrow ColorPicker__arrow--${
                          theme === GrafanaTheme.Light ? 'light' : 'dark'
                        }`}
                      />
                    );
                  }}
                />
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
