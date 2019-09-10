// Libraries
import React, { PureComponent, ChangeEvent } from 'react';

// Components
import { FormLabel } from '../FormLabel/FormLabel';
import { FormField } from '../FormField/FormField';
import { StatsPicker } from '../StatsPicker/StatsPicker';

// Types
import { FieldDisplayOptions, DEFAULT_FIELD_DISPLAY_VALUES_LIMIT } from '../../utils/fieldDisplay';
import Select from '../Select/Select';
import {
  ReducerID,
  toNumberString,
  toIntegerOrUndefined,
  SelectableValue,
  FieldConfig,
  NullValueMode,
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

const nullValueModes: Array<SelectableValue<NullValueMode>> = [
  {
    value: NullValueMode.AsZero,
    label: 'As Zero',
    description: 'Show the result as zero',
  },
  {
    value: NullValueMode.Ignore,
    label: 'Ignore',
    description: 'Ignore null values.  In a graph this will look connected',
  },
  {
    value: NullValueMode.Null,
    label: 'As Null',
    description: 'Show missing values',
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

  onDefaultsChange = (value: FieldConfig) => {
    this.props.onChange({ ...this.props.value, defaults: value });
  };

  onLimitChange = (event: ChangeEvent<HTMLInputElement>) => {
    this.props.onChange({
      ...this.props.value,
      limit: toIntegerOrUndefined(event.target.value),
    });
  };

  onNullValueModeChange = (item: SelectableValue<NullValueMode>) => {
    this.onDefaultsChange({ ...this.props.value.defaults, nullValueMode: item.value });
  };

  render() {
    const { value } = this.props;
    const { calcs, values, limit, defaults } = value;
    const { nullValueMode } = defaults;

    const labelWidth = this.props.labelWidth || 6;

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

        <div className="gf-form">
          <FormLabel width={labelWidth} tooltip="How should null values be shown?">
            Null Values
          </FormLabel>
          <Select
            width={12}
            value={nullValueModes.find(v => v.value === nullValueMode)}
            isClearable={true}
            isSearchable={true}
            options={nullValueModes}
            placeholder="Auto"
            onChange={this.onNullValueModeChange}
          />
        </div>
      </>
    );
  }
}
