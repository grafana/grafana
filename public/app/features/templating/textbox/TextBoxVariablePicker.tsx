import React, { ChangeEvent, FocusEvent, KeyboardEvent, PureComponent } from 'react';

import { TextBoxVariableModel } from '../variable';
import { VariablePickerProps } from '../state/types';
import { dispatch } from '../../../store/store';
import { changeVariableProp, toVariablePayload } from '../state/actions';
import { variableAdapters } from '../adapters';

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
    if (!this.props.variable) {
      return <div>Couldn't load variable</div>;
    }

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
