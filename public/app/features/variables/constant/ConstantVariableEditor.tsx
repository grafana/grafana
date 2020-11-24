import React, { ChangeEvent, FocusEvent, PureComponent } from 'react';
import { selectors } from '@grafana/e2e-selectors';
import { VerticalGroup } from '@grafana/ui';

import { ConstantVariableModel } from '../types';
import { VariableEditorProps } from '../editor/types';
import { VariableSectionHeader } from '../editor/VariableSectionHeader';
import { VariableTextField } from '../editor/VariableTextField';

export interface Props extends VariableEditorProps<ConstantVariableModel> {}

export class ConstantVariableEditor extends PureComponent<Props> {
  onChange = (event: ChangeEvent<HTMLInputElement>) => {
    this.props.onPropChange({
      propName: 'query',
      propValue: event.target.value,
    });
  };

  onBlur = (event: FocusEvent<HTMLInputElement>) => {
    this.props.onPropChange({
      propName: 'query',
      propValue: event.target.value,
      updateOptions: true,
    });
  };

  render() {
    return (
      <VerticalGroup spacing="xs">
        <VariableSectionHeader name="Constant Options" />
        <VariableTextField
          value={this.props.variable.query}
          name="Value"
          placeholder="your metric prefix"
          onChange={this.onChange}
          onBlur={this.onBlur}
          labelWidth={20}
          ariaLabel={selectors.pages.Dashboard.Settings.Variables.Edit.ConstantVariable.constantOptionsQueryInput}
          grow
        />
      </VerticalGroup>
    );
  }
}
