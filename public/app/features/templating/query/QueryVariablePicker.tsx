import React, { PureComponent } from 'react';

import { QueryVariableModel } from '../variable';
import { QueryVariablePickerState } from './reducer';
import { VariablePickerProps } from '../state/types';
import { VariableOptionsDropDown } from '../picker/VariableOptionsDropDown';
import { VariableOptionsLinkText } from '../picker/VariableOptionsLinkText';
import { VariableOptionsInput } from '../picker/VariableOptionsInput';

export interface Props extends VariablePickerProps<QueryVariableModel, QueryVariablePickerState> {}

export class QueryVariablePicker extends PureComponent<Props> {
  render() {
    const { showDropDown } = this.props.picker;

    if (!this.props.variable) {
      return <div>Couldn't load variable</div>;
    }

    return (
      <div className="variable-link-wrapper">
        {!showDropDown && <VariableOptionsLinkText variable={this.props.variable} picker={this.props.picker} />}
        {showDropDown && <VariableOptionsInput variable={this.props.variable} picker={this.props.picker} />}
        {showDropDown && <VariableOptionsDropDown variable={this.props.variable} picker={this.props.picker} />}
      </div>
    );
  }
}
