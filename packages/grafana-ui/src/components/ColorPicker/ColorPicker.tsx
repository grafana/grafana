import React, { Component, createRef } from 'react';
import { omit } from 'lodash';
import { PopperController } from '../Tooltip/PopperController';
import { Popper } from '../Tooltip/Popper';
import { ColorPickerPopover, ColorPickerProps, ColorPickerChangeHandler } from './ColorPickerPopover';
import { getColorFromHexRgbOrName } from '../../utils/namedColorsPalette';
import { SeriesColorPickerPopover } from './SeriesColorPickerPopover';

import { withTheme } from '../../themes/ThemeContext';
import { ColorPickerTrigger } from './ColorPickerTrigger';

type ColorPickerTriggerRenderer = (props: {
  ref: React.RefObject<any>;
  showColorPicker: () => void;
  hideColorPicker: () => void;
}) => React.ReactNode;

export const colorPickerFactory = <T extends ColorPickerProps>(
  popover: React.ComponentType<T>,
  displayName = 'ColorPicker'
) => {
  return class ColorPicker extends Component<T & { children?: ColorPickerTriggerRenderer }, any> {
    static displayName = displayName;
    pickerTriggerRef = createRef<any>();

    onColorChange = (color: string) => {
      const { onColorChange, onChange } = this.props;
      const changeHandler = (onColorChange || onChange) as ColorPickerChangeHandler;

      return changeHandler(color);
    };

    render() {
      const { theme, children } = this.props;
      const popoverElement = React.createElement(popover, {
        ...omit(this.props, 'children'),
        onChange: this.onColorChange,
      });

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
                  (children as ColorPickerTriggerRenderer)({
                    ref: this.pickerTriggerRef,
                    showColorPicker: showPopper,
                    hideColorPicker: hidePopper,
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
