import React, { ChangeEvent, FocusEvent, KeyboardEvent, PureComponent } from 'react';

import { TextBoxVariableModel } from '../types';
import { toVariableIdentifier, toVariablePayload } from '../state/types';
import { dispatch } from '../../../store/store';
import { changeVariableProp } from '../state/sharedReducer';
import { VariablePickerProps } from '../pickers/types';
import { updateOptions } from '../state/actions';

export interface Props extends VariablePickerProps<TextBoxVariableModel> {}

export class TextBoxVariablePicker extends PureComponent<Props> {
  onQueryChange = (event: ChangeEvent<HTMLInputElement>) => {
    dispatch(
      changeVariableProp(toVariablePayload(this.props.variable, { propName: 'query', propValue: event.target.value }))
    );
  };

  onQueryBlur = (event: FocusEvent<HTMLInputElement>) => {
    if (this.props.variable.current.value !== this.props.variable.query) {
      dispatch(updateOptions(toVariableIdentifier(this.props.variable)));
    }
  };

  onQueryKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.keyCode === 13 && this.props.variable.current.value !== this.props.variable.query) {
      dispatch(updateOptions(toVariableIdentifier(this.props.variable)));
    }
  };

  render() {
    return (
      <input
        type="text"
        value={this.props.variable.query}
        className="gf-form-input width-12"
        onChange={this.onQueryChange}
        onBlur={this.onQueryBlur}
        onKeyDown={this.onQueryKeyDown}
      />
    );
  }
}
