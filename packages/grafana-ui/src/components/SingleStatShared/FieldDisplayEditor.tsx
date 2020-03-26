// Libraries
import React, { PureComponent, ChangeEvent } from 'react';

// Components
import { FormLabel } from '../FormLabel/FormLabel';
import { FormField } from '../FormField/FormField';
import { StatsPicker } from '../StatsPicker/StatsPicker';

// Types
import Select from '../Select/Select';
import {
  FieldDisplayOptions,
  DEFAULT_FIELD_DISPLAY_VALUES_LIMIT,
  ReducerID,
  toNumberString,
  toIntegerOrUndefined,
  SelectableValue,
} from '@grafana/data';

const showOptions: Array<SelectableValue<boolean>> = [
  {
    value: true,
    label: 'All Values',
    description: 'Each row in the response data',
  },
  {
    value: false,
    label: 'Calculation',
    description: 'Calculate a value based on the response',
  },
];

export interface Props {
  labelWidth?: number;
  value: FieldDisplayOptions;
  onChange: (value: FieldDisplayOptions, event?: React.SyntheticEvent<HTMLElement>) => void;
}

export class FieldDisplayEditor extends PureComponent<Props> {
  onShowValuesChange = (item: SelectableValue<boolean>) => {
    const val = item.value === true;
    this.props.onChange({ ...this.props.value, values: val });
  };

  onCalcsChange = (calcs: string[]) => {
    this.props.onChange({ ...this.props.value, calcs });
  };

  onLimitChange = (event: ChangeEvent<HTMLInputElement>) => {
    this.props.onChange({
      ...this.props.value,
      limit: toIntegerOrUndefined(event.target.value),
    });
  };

  render() {
    const { value } = this.props;
    const { calcs, values, limit } = value;

    const labelWidth = this.props.labelWidth || 5;

    return (
      <>
        <div className="gf-form">
          <FormLabel width={labelWidth}>Show</FormLabel>
          <Select
            options={showOptions}
            value={values ? showOptions[0] : showOptions[1]}
            onChange={this.onShowValuesChange}
          />
        </div>
        {values ? (
          <FormField
            label="Limit"
            labelWidth={labelWidth}
            placeholder={`${DEFAULT_FIELD_DISPLAY_VALUES_LIMIT}`}
            onChange={this.onLimitChange}
            value={toNumberString(limit)}
            type="number"
          />
        ) : (
          <div className="gf-form">
            <FormLabel width={labelWidth}>Calc</FormLabel>
            <StatsPicker
              width={12}
              placeholder="Choose Stat"
              defaultStat={ReducerID.mean}
              allowMultiple={false}
              stats={calcs}
              onChange={this.onCalcsChange}
            />
          </div>
        )}
      </>
    );
  }
}
