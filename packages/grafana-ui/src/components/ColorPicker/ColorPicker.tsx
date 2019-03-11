import React, { Component, createRef } from 'react';
import { PopperController } from '../Tooltip/PopperController';
import { Popper } from '../Tooltip/Popper';
import { ColorPickerPopover, ColorPickerProps, ColorPickerChangeHandler } from './ColorPickerPopover';
import { getColorFromHexRgbOrName } from '../../utils/namedColorsPalette';
import { SeriesColorPickerPopover } from './SeriesColorPickerPopover';

import { withTheme } from '../../themes/ThemeContext';
import { ColorPickerTrigger } from './ColorPickerTrigger';

export const colorPickerFactory = <T extends ColorPickerProps>(
  popover: React.ComponentType<T>,
  displayName = 'ColorPicker'
) => {
  return class ColorPicker extends Component<T, any> {
    static displayName = displayName;
    pickerTriggerRef = createRef<HTMLDivElement>();

    onColorChange = (color: string) => {
      const { onColorChange, onChange } = this.props;
      const changeHandler = (onColorChange || onChange) as ColorPickerChangeHandler;

      return changeHandler(color);
    };

    render() {
      const popoverElement = React.createElement(popover, {
        ...this.props,
        onChange: this.onColorChange,
      });
      const { theme, children } = this.props;

      return (
        <PopperController content={popoverElement} hideAfter={300}>
          {(showPopper, hidePopper, popperProps) => {
            return (
              <>
                {this.pickerTriggerRef.current && (
                  <Popper
                    {...popperProps}
                    referenceElement={this.pickerTriggerRef.current}
                    wrapperClassName="ColorPicker"
                    onMouseLeave={hidePopper}
                    onMouseEnter={showPopper}
                  />
                )}

                {children ? (
                  React.cloneElement(children as JSX.Element, {
                    ref: this.pickerTriggerRef,
                    onClick: showPopper,
                    onMouseLeave: hidePopper,
                  })
                ) : (
                  <ColorPickerTrigger
                    ref={this.pickerTriggerRef}
                    onClick={showPopper}
                    onMouseLeave={hidePopper}
                    color={getColorFromHexRgbOrName(this.props.color || '#000000', theme.type)}
                  />
                )}
              </>
            );
          }}
        </PopperController>
      );
    }
  };
};

export const ColorPicker = withTheme(colorPickerFactory(ColorPickerPopover, 'ColorPicker'));
export const SeriesColorPicker = withTheme(colorPickerFactory(SeriesColorPickerPopover, 'SeriesColorPicker'));
