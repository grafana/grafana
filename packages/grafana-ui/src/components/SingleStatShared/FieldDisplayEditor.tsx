// Libraries
import React, { PureComponent, ChangeEvent } from 'react';

// Components
import { FormField, FormLabel, PanelOptionsGroup, StatsPicker, ReducerID } from '@grafana/ui';

// Types
import { FieldDisplayOptions, DEFAULT_FIELD_DISPLAY_VALUES_LIMIT } from '../../utils/fieldDisplay';
import { Field } from '../../types/data';
import Select, { SelectOptionItem } from '../Select/Select';
import { toNumberString, toIntegerOrUndefined } from '../../utils';

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
  options: FieldDisplayOptions;
  onChange: (valueOptions: FieldDisplayOptions) => void;
  labelWidth?: number;
  children?: JSX.Element[];
}

export class FieldDisplayEditor extends PureComponent<Props> {
  onShowValuesChange = (item: SelectOptionItem<boolean>) => {
    const val = item.value === true;
    this.props.onChange({ ...this.props.options, values: val });
  };

  onCalcsChange = (calcs: string[]) => {
    this.props.onChange({ ...this.props.options, calcs });
  };

  onDefaultsChange = (value: Partial<Field>) => {
    this.props.onChange({ ...this.props.options, defaults: value });
  };

  onLimitChange = (event: ChangeEvent<HTMLInputElement>) => {
    this.props.onChange({
      ...this.props.options,
      limit: toIntegerOrUndefined(event.target.value),
    });
  };

  render() {
    const { options, children } = this.props;
    const { calcs, values, limit } = options;

    const labelWidth = this.props.labelWidth || 5;

    return (
      <PanelOptionsGroup title="Display">
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
          {children}
        </>
      </PanelOptionsGroup>
    );
  }
}
