// Libraries
import React, { PureComponent, ChangeEvent } from 'react';

// Components
import { FormLabel } from '../FormLabel/FormLabel';
import { FormField } from '../FormField/FormField';
import { StatsPicker } from '../StatsPicker/StatsPicker';

// Types
import { FieldDisplayOptions, DEFAULT_FIELD_DISPLAY_VALUES_LIMIT } from '../../utils/fieldDisplay';
import { Field } from '../../types/data';
import Select, { SelectOptionItem } from '../Select/Select';
import { toNumberString, toIntegerOrUndefined } from '@grafana/data';
import { ReducerID } from '../../utils/fieldReducer';

const showOptions: Array<SelectOptionItem<boolean>> = [
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
  onShowValuesChange = (item: SelectOptionItem<boolean>) => {
    const val = item.value === true;
    this.props.onChange({ ...this.props.value, values: val });
  };

  onCalcsChange = (calcs: string[]) => {
    this.props.onChange({ ...this.props.value, calcs });
  };

  onDefaultsChange = (value: Partial<Field>) => {
    this.props.onChange({ ...this.props.value, defaults: value });
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
