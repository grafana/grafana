import React, { Component, createRef } from 'react';
import PopperController from '../Tooltip/PopperController';
import Popper, { RenderPopperArrowFn } from '../Tooltip/Popper';
import { ColorPickerPopover } from './ColorPickerPopover';
import { Themeable, GrafanaTheme } from '../../types';
import { getColorFromHexRgbOrName } from '../../utils/colorsPalette';

export interface ColorPickerProps extends Themeable {
  color: string;
  onChange: (color: string) => void;
  withArrow?: boolean;
  children?: JSX.Element;
}

export const colorPickerFactory = <T extends ColorPickerProps>(
  popover: React.ComponentType<T>,
  displayName?: string,
  renderPopoverArrowFunction?: RenderPopperArrowFn
) => {
  return class ColorPicker extends Component<T, any> {
    static displayName = displayName || 'ColorPicker';
    pickerTriggerRef = createRef<HTMLDivElement>();

    render() {
      const popoverElement = React.createElement(popover, this.props);
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
        <PopperController content={popoverElement} placement="bottom-start">
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
                  <div ref={this.pickerTriggerRef} onClick={showPopper} className="sp-replacer sp-light">
                    <div className="sp-preview">
                      <div
                        className="sp-preview-inner"
                        style={{
                          backgroundColor: getColorFromHexRgbOrName(this.props.color, theme),
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

export default colorPickerFactory(ColorPickerPopover, 'ColorPicker');
