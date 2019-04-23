import React, { Component, createRef } from 'react';
import { omit } from 'lodash';
import { PopperController } from '../Tooltip/PopperController';
import { Popper } from '../Tooltip/Popper';
import { ColorPickerPopover, ColorPickerProps, ColorPickerChangeHandler } from './ColorPickerPopover';
import { getColorFromHexRgbOrName } from '../../utils/namedColorsPalette';
import { SeriesColorPickerPopover } from './SeriesColorPickerPopover';

import { withTheme } from '../../themes/ThemeContext';
import { ColorPickerTrigger } from './ColorPickerTrigger';

/**
 * If you need custom trigger for the color picker you can do that with a render prop pattern and supply a function
 * as a child. You will get show/hide function which you can map to desired interaction (like onClick or onMouseLeave)
 * and a ref which needs to be passed to an HTMLElement for correct positioning. If you want to use class or functional
 * component as a custom trigger you will need to forward the reference to first HTMLElement child.
 */
type ColorPickerTriggerRenderer = (props: {
  // This should be a React.RefObject<HTMLElement> but due to how object refs are defined you cannot downcast from that
  // to a specific type like React.RefObject<HTMLDivElement> even though it would be fine in runtime.
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
                  // Children have a bit weird type due to intersection used in the definition so we need to cast here,
                  // but the definition is correct and should not allow to pass a children that does not conform to
                  // ColorPickerTriggerRenderer type.
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
