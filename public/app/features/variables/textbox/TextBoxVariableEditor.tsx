import React, { ChangeEvent, PureComponent } from 'react';
import { VerticalGroup } from '@grafana/ui';

import { TextBoxVariableModel } from '../types';
import { VariableEditorProps } from '../editor/types';
import { VariableSectionHeader } from '../editor/VariableSectionHeader';
import { VariableTextField } from '../editor/VariableTextField';

export interface Props extends VariableEditorProps<TextBoxVariableModel> {}
export class TextBoxVariableEditor extends PureComponent<Props> {
  onQueryChange = (event: ChangeEvent<HTMLInputElement>) => {
    event.preventDefault();
    this.props.onPropChange({ propName: 'query', propValue: event.target.value, updateOptions: false });
  };
  onQueryBlur = (event: ChangeEvent<HTMLInputElement>) => {
    event.preventDefault();
    this.props.onPropChange({ propName: 'query', propValue: event.target.value, updateOptions: true });
  };
  render() {
    const { query } = this.props.variable;
    return (
      <VerticalGroup spacing="xs">
        <VariableSectionHeader name="Text Options" />
        <VariableTextField
          value={query}
          name="Default value"
          placeholder="default value, if any"
          onChange={this.onQueryChange}
          onBlur={this.onQueryBlur}
          labelWidth={20}
          grow
        />
      </VerticalGroup>
    );
  }
}
