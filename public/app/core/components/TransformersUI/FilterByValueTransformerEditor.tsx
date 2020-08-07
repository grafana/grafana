import React, { useMemo } from 'react';
import {
  DataTransformerID,
  SelectableValue,
  standardTransformers,
  TransformerRegistyItem,
  TransformerUIProps,
} from '@grafana/data';
import { getAllFieldNamesFromDataFrames } from './OrganizeFieldsTransformerEditor';
import { Select, Button, Input } from '@grafana/ui';
import { selectors } from '@grafana/e2e-selectors';

import {
  FilterByValueTransformerOptions,
  ValueFilter,
} from '@grafana/data/src/transformations/transformers/filterByValue';

function FilterSelectorRow(props: any) {
  const { fieldNameOptions, onDelete, onConfigChange, config } = props;

  return (
    <div className="gf-form-inline">
      <div className="gf-form">
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
      <div className="gf-form gf-form--offset-1">
        <div className="gf-form-label width-8">Filter on Field</div>
        <Select
          className="width-16"
          placeholder="Field Name"
          options={fieldNameOptions}
          value={config.fieldName}
          onChange={value => {
            console.log('onChange fieldName', value);
            onConfigChange({ ...config, fieldName: value });
          }}
          isClearable
          menuPlacement="bottom"
        />
      </div>
      <div className="gf-form gf-form--grow gf-form--offset-1">
        <div className="gf-form-label width-8">Filter Expression</div>
        <Input
          className="flex-grow-1"
          // defaultValue={''}
          value={config.filterExpression}
          placeholder={`Regex`}
          onBlur={event => {
            console.log('onBlur', event.currentTarget.value);
            onConfigChange({ ...config, filterExpression: event.currentTarget.value });
          }}
        />
      </div>
      <div className="gf-form gf-form--offset-1">
        <Button icon="trash-alt" onClick={onDelete} style={{ margin: 'auto' }} size="sm" variant="secondary" />
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
    options.valueFilters.push({
      type: 'include',
      fieldName: null,
      filterExpression: null,
    });

    onChange({
      ...options,
    });
  };

  const onDeleteFilter = (index: number) => () => {
    options.valueFilters.splice(index, 1);
    onChange({
      ...options,
    });
  };

  const onConfigChange = (index: number) => (config: ValueFilter) => {
    console.log('onConfigChange', index, config, options);
    options.valueFilters[index] = config;
    onChange({
      ...options,
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

      <div className="gf-form-inline gf-form--offset-1">
        <Button icon="plus" onClick={onAddFilter}>
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
