import React, { createRef } from 'react';
import * as PopperJS from 'popper.js';
import { SeriesColorPickerPopover } from './SeriesColorPickerPopover';
import PopperController from '../Tooltip/PopperController';
import Popper from '../Tooltip/Popper';
import { Themeable, GrafanaTheme } from '../../types';
import { ColorPickerProps } from './ColorPicker';

export interface SeriesColorPickerProps extends ColorPickerProps, Themeable {
  yaxis?: number;
  optionalClass?: string;
  onToggleAxis?: () => void;
  children: JSX.Element;
}

export class SeriesColorPicker extends React.Component<SeriesColorPickerProps> {
  private pickerTriggerRef = createRef<PopperJS.ReferenceObject>();
  colorPickerDrop: any;

  static defaultProps = {
    optionalClass: '',
    yaxis: undefined,
    onToggleAxis: () => {},
  };

  renderPickerTabs = () => {
    const { color, yaxis, onChange, onToggleAxis, theme } = this.props;
    return (
      <SeriesColorPickerPopover
        theme={theme}
        color={color}
        yaxis={yaxis}
        onChange={onChange}
        onToggleAxis={onToggleAxis}
      />
    );
  };

  render() {
    const { children, theme } = this.props;
    return (
      <PopperController placement="bottom-start" content={this.renderPickerTabs()}>
        {(showPopper, hidePopper, popperProps) => {
          return (
            <>
              {this.pickerTriggerRef.current && (
                <Popper
                  {...popperProps}
                  onMouseEnter={showPopper}
                  onMouseLeave={hidePopper}
                  referenceElement={this.pickerTriggerRef.current}
                  wrapperClassName="ColorPicker"
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

              {React.cloneElement(children, {
                ref: this.pickerTriggerRef,
                onClick: showPopper,
                onMouseLeave: hidePopper,
              })}
            </>
          );
        }}
      </PopperController>
    );
  }
}
