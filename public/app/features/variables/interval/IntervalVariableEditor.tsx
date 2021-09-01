import React, { ChangeEvent, FormEvent, PureComponent } from 'react';
import { InlineFieldRow, VerticalGroup } from '@grafana/ui';

import { IntervalVariableModel } from '../types';
import { VariableEditorProps } from '../editor/types';
import { VariableSectionHeader } from '../editor/VariableSectionHeader';
import { VariableTextField } from '../editor/VariableTextField';
import { VariableSwitchField } from '../editor/VariableSwitchField';
import { VariableSelectField } from '../editor/VariableSelectField';
import { SelectableValue } from '@grafana/data';

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
      <VerticalGroup spacing="xs">
        <VariableSectionHeader name="Interval options" />
        <VerticalGroup spacing="none">
          <VariableTextField
            value={this.props.variable.query}
            name="Values"
            placeholder="1m,10m,1h,6h,1d,7d"
            onChange={this.onQueryChanged}
            onBlur={this.onQueryBlur}
            labelWidth={20}
            grow
            required
          />
          <InlineFieldRow>
            <VariableSwitchField
              value={this.props.variable.auto}
              name="Auto option"
              tooltip="Dynamically calculates interval by dividing time range by the count specified."
              onChange={this.onAutoChange}
            />
            {this.props.variable.auto ? (
              <>
                <VariableSelectField
                  name="Step count"
                  value={stepValue}
                  options={stepOptions}
                  onChange={this.onAutoCountChanged}
                  tooltip="How many times the current time range should be divided to calculate the value."
                  labelWidth={7}
                  width={9}
                />
                <VariableTextField
                  value={this.props.variable.auto_min}
                  name="Min interval"
                  placeholder="10s"
                  onChange={this.onAutoMinChanged}
                  tooltip="The calculated value will not go below this threshold."
                  labelWidth={13}
                  width={11}
                />
              </>
            ) : null}
          </InlineFieldRow>
        </VerticalGroup>
      </VerticalGroup>
    );
  }
}
