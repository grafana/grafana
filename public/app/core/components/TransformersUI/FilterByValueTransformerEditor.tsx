import React, { useMemo } from 'react';
import { DataTransformerID, standardTransformers, TransformerRegistyItem, TransformerUIProps } from '@grafana/data';
import { getAllFieldNamesFromDataFrames } from './OrganizeFieldsTransformerEditor';
import { Select, Button, Input } from '@grafana/ui';

import {
  FilterByValueTransformerOptions,
  ValueFilter,
} from '@grafana/data/src/transformations/transformers/filterByValue';

import { valueFiltersRegistry, ValueFilterID } from '@grafana/data/src/transformations/valueFilters';

function FilterSelectorRow(props: any) {
  const { fieldNameOptions, onDelete, onConfigChange, config } = props;

  let filterOptionsInput = null;

  let placeholder = valueFiltersRegistry.get(config.filterType).placeholder || null;

  if (placeholder) {
    filterOptionsInput = (
      <>
        <Input
          className="flex-grow-1"
          defaultValue={config.filterExpression}
          placeholder={placeholder}
          onBlur={event => {
            onConfigChange({ ...config, filterExpression: event.currentTarget.value });
          }}
        />
      </>
    );
  }

  return (
    <div className="gf-form-inline">
      <div className="gf-form gf-form-spacing">
        <div className="gf-form-label width-8">Filter Type</div>
        <Select
          className="width-8"
          options={[
            { label: 'Include', value: 'include' },
            { label: 'Exclude', value: 'exclude' },
          ]}
          value={config.type}
          onChange={option => {
            console.log('onChange filterType', option.value);
            onConfigChange({ ...config, type: option.value });
          }}
          menuPlacement="bottom"
        />
      </div>
      <div className="gf-form gf-form-spacing">
        <div className="gf-form-label width-8">Filter on Field</div>
        <Select
          className="width-16"
          placeholder="Field Name"
          options={fieldNameOptions}
          value={config.fieldName}
          onChange={value => {
            // console.log('onChange fieldName', value);
            if (value === null) {
              onConfigChange({ ...config, fieldName: null });
            } else {
              onConfigChange({ ...config, fieldName: value.value });
            }
          }}
          isClearable
          menuPlacement="bottom"
        />
      </div>
      <div className="gf-form gf-form-spacing">
        <div className="gf-form-label width-4">Test</div>
        <Select
          className="width-8"
          placeholder="Select test"
          options={valueFiltersRegistry.selectOptions().options}
          value={config.filterType}
          onChange={value => {
            // console.log('onChange test', value);
            onConfigChange({ ...config, filterType: value.value });
          }}
          menuPlacement="bottom"
        />
      </div>
      <div className="gf-form gf-form--grow gf-form-spacing ">{filterOptionsInput}</div>
      <div className="gf-form">
        <Button icon="times" onClick={onDelete} style={{ height: '100%' }} size="sm" variant="secondary" />
      </div>
    </div>
  );
}

export const FilterByValueTransformerEditor: React.FC<TransformerUIProps<FilterByValueTransformerOptions>> = ({
  input,
  options,
  onChange,
}) => {
  const fieldNames = useMemo(() => getAllFieldNamesFromDataFrames(input), [input]);
  const fieldNameOptions = fieldNames.map((item: string) => ({ label: item, value: item }));

  const onAddFilter = () => {
    let valueFilters = options.valueFilters.map(filter => ({ ...filter })); // Deep copy
    valueFilters.push({
      type: 'include',
      fieldName: null,
      filterExpression: null,
      filterType: ValueFilterID.regex,
    });

    onChange({
      ...options,
      valueFilters,
    });
  };

  const onDeleteFilter = (index: number) => () => {
    let valueFilters = options.valueFilters.map(filter => ({ ...filter })); // Deep copy
    valueFilters.splice(index, 1);
    onChange({
      ...options,
      valueFilters,
    });
  };

  const onConfigChange = (index: number) => (config: ValueFilter) => {
    console.log('onConfigChange', index, config, options);
    let valueFilters = options.valueFilters.map(filter => ({ ...filter })); // Deep copy
    valueFilters[index] = config;
    onChange({
      ...options,
      valueFilters: valueFilters as ValueFilter[],
    });
  };

  return (
    <div>
      {options.valueFilters.map((val, idx) => (
        <FilterSelectorRow
          onConfigChange={onConfigChange(idx)}
          onDelete={onDeleteFilter(idx)}
          fieldNameOptions={fieldNameOptions}
          config={val}
        />
      ))}

      <div className="gf-form-inline">
        <Button icon="plus" onClick={onAddFilter} variant="secondary">
          Add filter
        </Button>
      </div>
    </div>
  );
};

export const filterByValueTransformRegistryItem: TransformerRegistyItem<FilterByValueTransformerOptions> = {
  id: DataTransformerID.filterByValue,
  editor: FilterByValueTransformerEditor,
  transformation: standardTransformers.filterByValueTransformer,
  name: standardTransformers.filterByValueTransformer.name,
  description: standardTransformers.filterByValueTransformer.description,
};
