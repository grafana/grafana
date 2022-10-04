import React, { ChangeEvent, FormEvent, PureComponent } from 'react';

import { SelectableValue } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Legend } from '@grafana/ui';

import { VariableSelectField } from '../editor/VariableSelectField';
import { VariableSwitchField } from '../editor/VariableSwitchField';
import { VariableTextField } from '../editor/VariableTextField';
import { VariableEditorProps } from '../editor/types';
import { IntervalVariableModel } from '../types';

export interface Props extends VariableEditorProps<IntervalVariableModel> {}

export class IntervalVariableEditor extends PureComponent<Props> {
  onAutoChange = (event: ChangeEvent<HTMLInputElement>) => {
    this.props.onPropChange({
      propName: 'auto',
      propValue: event.target.checked,
      updateOptions: true,
    });
  };

  onQueryChanged = (event: FormEvent<HTMLInputElement>) => {
    this.props.onPropChange({
      propName: 'query',
      propValue: event.currentTarget.value,
    });
  };

  onQueryBlur = (event: FormEvent<HTMLInputElement>) => {
    this.props.onPropChange({
      propName: 'query',
      propValue: event.currentTarget.value,
      updateOptions: true,
    });
  };

  onAutoCountChanged = (option: SelectableValue<number>) => {
    this.props.onPropChange({
      propName: 'auto_count',
      propValue: option.value,
      updateOptions: true,
    });
  };

  onAutoMinChanged = (event: FormEvent<HTMLInputElement>) => {
    this.props.onPropChange({
      propName: 'auto_min',
      propValue: event.currentTarget.value,
      updateOptions: true,
    });
  };

  render() {
    const { variable } = this.props;
    const stepOptions = [1, 2, 3, 4, 5, 10, 20, 30, 40, 50, 100, 200, 300, 400, 500].map((count) => ({
      label: `${count}`,
      value: count,
    }));
    const stepValue = stepOptions.find((o) => o.value === variable.auto_count) ?? stepOptions[0];

    return (
      <>
        <Legend>Interval options</Legend>
        <VariableTextField
          value={this.props.variable.query}
          name="Values"
          placeholder="1m,10m,1h,6h,1d,7d"
          onChange={this.onQueryChanged}
          onBlur={this.onQueryBlur}
          testId={selectors.pages.Dashboard.Settings.Variables.Edit.IntervalVariable.intervalsValueInput}
          grow
          required
        />

        <VariableSwitchField
          value={this.props.variable.auto}
          name="Auto option"
          description="Dynamically calculates interval by dividing time range by the count specified"
          onChange={this.onAutoChange}
        />
        {this.props.variable.auto && (
          <>
            <VariableSelectField
              name="Step count"
              description="How many times the current time range should be divided to calculate the value"
              value={stepValue}
              options={stepOptions}
              onChange={this.onAutoCountChanged}
              width={9}
            />
            <VariableTextField
              value={this.props.variable.auto_min}
              name="Min interval"
              description="The calculated value will not go below this threshold"
              placeholder="10s"
              onChange={this.onAutoMinChanged}
              width={11}
            />
          </>
        )}
      </>
    );
  }
}
