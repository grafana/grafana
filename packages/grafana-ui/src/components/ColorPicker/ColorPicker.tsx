import React, { Component, createRef } from 'react';
import PopperController from '../Tooltip/PopperController';
import Popper, { RenderPopperArrowFn } from '../Tooltip/Popper';
import { ColorPickerPopover } from './ColorPickerPopover';
import { Themeable, GrafanaTheme } from '../../types';
import { getColorFromHexRgbOrName } from '../../utils/namedColorsPalette';
import { SeriesColorPickerPopover } from './SeriesColorPickerPopover';
import propDeprecationWarning from '../../utils/propDeprecationWarning';

type ColorPickerChangeHandler = (color: string) => void;

export interface ColorPickerProps extends Themeable {
  color: string;
  onChange: ColorPickerChangeHandler;

  /**
   * @deprecated Use onChange instead
   */
  onColorChange?: ColorPickerChangeHandler;
  enableNamedColors?: boolean;
  withArrow?: boolean;
  children?: JSX.Element;
}

export const warnAboutColorPickerPropsDeprecation = (componentName: string, props: ColorPickerProps) => {
  const { onColorChange } = props;
  if (onColorChange) {
    propDeprecationWarning(componentName, 'onColorChange', 'onChange');
  }
};

export const colorPickerFactory = <T extends ColorPickerProps>(
  popover: React.ComponentType<T>,
  displayName = 'ColorPicker',
  renderPopoverArrowFunction?: RenderPopperArrowFn
) => {
  return class ColorPicker extends Component<T, any> {
    static displayName = displayName;
    pickerTriggerRef = createRef<HTMLDivElement>();

    handleColorChange = (color: string) => {
      const { onColorChange, onChange } = this.props;
      const changeHandler = (onColorChange || onChange) as ColorPickerChangeHandler;

      return changeHandler(color);
    };

    render() {
      const popoverElement = React.createElement(popover, {
        ...this.props,
        onChange: this.handleColorChange,
      });
      const { theme, withArrow, children } = this.props;

      const renderArrow: RenderPopperArrowFn = ({ arrowProps, placement }) => {
        return (
          <div
            {...arrowProps}
            data-placement={placement}
            className={`ColorPicker__arrow ColorPicker__arrow--${theme === GrafanaTheme.Light ? 'light' : 'dark'}`}
          />
        );
      };

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
                    renderArrow={withArrow && (renderPopoverArrowFunction || renderArrow)}
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
                  <div
                    ref={this.pickerTriggerRef}
                    onClick={showPopper}
                    onMouseLeave={hidePopper}
                    className="sp-replacer sp-light"
                  >
                    <div className="sp-preview">
                      <div
                        className="sp-preview-inner"
                        style={{
                          backgroundColor: getColorFromHexRgbOrName(this.props.color || '#000000', theme),
                        }}
                      />
                    </div>
                  </div>
                )}
              </>
            );
          }}
        </PopperController>
      );
    }
  };
};

export const ColorPicker = colorPickerFactory(ColorPickerPopover, 'ColorPicker');
export const SeriesColorPicker = colorPickerFactory(SeriesColorPickerPopover, 'SeriesColorPicker');
