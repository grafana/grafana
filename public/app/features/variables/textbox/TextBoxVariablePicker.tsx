import React, { ChangeEvent, FocusEvent, KeyboardEvent, PureComponent } from 'react';

import { TextBoxVariableModel } from '../../templating/types';
import { toVariablePayload } from '../state/types';
import { dispatch } from '../../../store/store';
import { variableAdapters } from '../adapters';
import { changeVariableProp } from '../state/sharedReducer';
import { VariablePickerProps } from '../pickers/types';

export interface Props extends VariablePickerProps<TextBoxVariableModel> {}

export class TextBoxVariablePicker extends PureComponent<Props> {
  onQueryChange = (event: ChangeEvent<HTMLInputElement>) => {
    dispatch(
      changeVariableProp(toVariablePayload(this.props.variable, { propName: 'query', propValue: event.target.value }))
    );
  };

  onQueryBlur = (event: FocusEvent<HTMLInputElement>) => {
    if (this.props.variable.current.value !== this.props.variable.query) {
      variableAdapters.get(this.props.variable.type).updateOptions(this.props.variable);
    }
  };

  onQueryKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.keyCode === 13 && this.props.variable.current.value !== this.props.variable.query) {
      variableAdapters.get(this.props.variable.type).updateOptions(this.props.variable);
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
