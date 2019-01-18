import React, { Component, createRef } from 'react';
import PopperController from '../Tooltip/PopperController';
import Popper from '../Tooltip/Popper';
import { ColorPickerPopover } from './ColorPickerPopover';
import { ColorDefinition } from '../../utils/colorsPalette';

interface Props {
  color: string;
  onChange: (c: string) => void;
}

export class ColorPicker extends Component<Props, any> {
  private pickerTriggerRef = createRef<HTMLDivElement>();
  pickerElem: HTMLElement | null;
  colorPickerDrop: any;

  onColorSelect = (color: ColorDefinition) => {
    this.props.onChange(color.name);
  };

  renderPickerTabs = () => {
    return <ColorPickerPopover color="" onColorSelect={() => {}} />;
  };

  render() {
    return (
      <PopperController content={this.renderPickerTabs}>
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
