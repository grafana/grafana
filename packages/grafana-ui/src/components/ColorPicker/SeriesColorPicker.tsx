import React, { createRef } from 'react';
import * as PopperJS from 'popper.js';
import { SeriesColorPickerPopover } from './SeriesColorPickerPopover';
import PopperController from '../Tooltip/PopperController';
import Popper from '../Tooltip/Popper';
import { GrafanaTheme } from '../../types';

export interface SeriesColorPickerProps {
  color: string;
  yaxis?: number;
  optionalClass?: string;
  onColorChange: (newColor: string) => void;
  onToggleAxis?: () => void;
  children: JSX.Element;
  theme?: GrafanaTheme;
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
    const { color, yaxis, onColorChange, onToggleAxis, theme } = this.props;
    return (
      <SeriesColorPickerPopover
        theme={theme}
        color={color}
        yaxis={yaxis}
        onColorChange={onColorChange}
        onToggleAxis={onToggleAxis}
      />
    );
  };

  render() {
    const { children } = this.props;

    return (
      <PopperController placement="bottom-start" content={this.renderPickerTabs}>
        {(showPopper, hidePopper, popperProps) => {
          return (
            <>
              {this.pickerTriggerRef.current && (
                <Popper
                  {...popperProps}
                  onMouseEnter={showPopper}
                  onMouseLeave={hidePopper}
                  referenceElement={this.pickerTriggerRef.current}
                  className="ColorPicker"
                  arrowClassName="popper__arrow"
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
