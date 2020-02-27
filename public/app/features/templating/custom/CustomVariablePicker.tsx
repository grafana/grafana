import React, { PureComponent } from 'react';

import { CustomVariableModel } from '../variable';
import { CustomVariablePickerState } from './reducer';
import { VariablePickerProps } from '../state/types';
import { CustomVariableOptionsDropDown } from './CustomVariableOptionsDropDown';
import { CustomVariableOptionsLinkText } from './CustomVariableOptionsLinkText';
import { CustomVariableOptionsInput } from './CustomVariableOptionsInput';

export interface Props extends VariablePickerProps<CustomVariableModel, CustomVariablePickerState> {}

export class CustomVariablePicker extends PureComponent<Props> {
  render() {
    const { showDropDown } = this.props.picker;

    if (!this.props.variable) {
      return <div>Couldn't load variable</div>;
    }

    return (
      <div className="variable-link-wrapper">
        {!showDropDown && <CustomVariableOptionsLinkText variable={this.props.variable} picker={this.props.picker} />}
        {showDropDown && <CustomVariableOptionsInput variable={this.props.variable} picker={this.props.picker} />}
        {showDropDown && <CustomVariableOptionsDropDown variable={this.props.variable} picker={this.props.picker} />}
      </div>
    );
  }
}
