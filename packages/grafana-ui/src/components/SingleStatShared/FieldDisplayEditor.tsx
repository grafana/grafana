// Libraries
import React, { PureComponent, ChangeEvent } from 'react';

// Components
import { FormField, FormLabel, PanelOptionsGroup, StatsPicker, StatID } from '@grafana/ui';

// Types
import { FieldDisplayOptions, DEFAULT_FIELD_DISPLAY_VALUES_LIMIT } from '../../utils/fieldDisplay';
import { Field } from '../../types/data';
import Select, { SelectOptionItem } from '../Select/Select';
import { toNumberString, toIntegerOrUndefined } from '../../utils';

const labelWidth = 5;

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
  showPrefixSuffix: boolean;
}

export class FieldDisplayEditor extends PureComponent<Props> {
  onShowValuesChange = (item: SelectOptionItem<boolean>) => {
    const val = item.value === true;
    this.props.onChange({ ...this.props.options, values: val });
  };

  onStatsChange = (stats: string[]) => {
    this.props.onChange({ ...this.props.options, stats });
  };

  onTitleChange = (event: ChangeEvent<HTMLInputElement>) =>
    this.props.onChange({ ...this.props.options, title: event.target.value });

  onDefaultsChange = (value: Partial<Field>) => {
    this.props.onChange({ ...this.props.options, defaults: value });
  };

  onPrefixChange = (event: ChangeEvent<HTMLInputElement>) =>
    this.props.onChange({ ...this.props.options, prefix: event.target.value });

  onSuffixChange = (event: ChangeEvent<HTMLInputElement>) =>
    this.props.onChange({ ...this.props.options, suffix: event.target.value });

  onLimitChange = (event: ChangeEvent<HTMLInputElement>) => {
    this.props.onChange({
      ...this.props.options,
      limit: toIntegerOrUndefined(event.target.value),
    });
  };

  render() {
    const { showPrefixSuffix, options } = this.props;
    const { title, stats, prefix, suffix, values, limit } = options;

    return (
      <PanelOptionsGroup title="Display">
        <>
          <FormField
            label="Title"
            labelWidth={labelWidth}
            onChange={this.onTitleChange}
            value={title}
            placeholder="Auto"
          />
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
                defaultStat={StatID.mean}
                allowMultiple={false}
                stats={stats}
                onChange={this.onStatsChange}
              />
            </div>
          )}
          {showPrefixSuffix && (
            <>
              <FormField label="Prefix" labelWidth={labelWidth} onChange={this.onPrefixChange} value={prefix || ''} />
              <FormField label="Suffix" labelWidth={labelWidth} onChange={this.onSuffixChange} value={suffix || ''} />
            </>
          )}
        </>
      </PanelOptionsGroup>
    );
  }
}
