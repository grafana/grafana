import React, { useMemo, useCallback } from 'react';
import {
  DataTransformerID,
  standardTransformers,
  TransformerRegistyItem,
  TransformerUIProps,
  getFieldDisplayName,
  Field,
  DataFrame,
  SelectableValue,
  FieldType,
} from '@grafana/data';
import { getAllFieldNamesFromDataFrames } from './OrganizeFieldsTransformerEditor';
import { Select, Button, Input } from '@grafana/ui';
import cloneDeep from 'lodash/cloneDeep';
import {
  FilterByValueTransformerOptions,
  ValueFilter,
} from '@grafana/data/src/transformations/transformers/filterByValue';

import { valueFiltersRegistry, ValueFilterID } from '@grafana/data/src/transformations/valueFilters';

interface RowProps {
  fieldNameOptions: Array<SelectableValue<string>>;
  onDelete: () => void;
  onConfigChange: (config: ValueFilter) => void;
  config: ValueFilter;
  fieldType: FieldType;
}

const FilterSelectorRow: React.FC<RowProps> = props => {
  const { fieldNameOptions, onDelete, onConfigChange, config, fieldType } = props;

  // Find filter types that fit the chosen field type
  const filterTypeOptions = useMemo(() => {
    return valueFiltersRegistry
      .list()
      .filter(element => {
        if (!Array.isArray(element?.supportedFieldTypes)) {
          return true;
        }
        return element.supportedFieldTypes.includes(fieldType);
      })
      .map(item => ({
        value: item.id,
        label: item.name,
        description: item.description,
      }));
  }, [fieldType]);

  const filterInfo = valueFiltersRegistry.get(config.filterType);
  const filterValid = filterInfo.getInstance({
    filterExpression: config.filterExpression,
    fieldType: fieldType,
  }).isValid;

  const fieldNameInvalid = config.fieldName === null || !fieldNameOptions.find(item => item.value === config.fieldName);
  const filterTypeInvalid =
    !fieldNameInvalid && filterInfo.supportedFieldTypes && !filterInfo.supportedFieldTypes.includes(fieldType);
  const filterExpressionInvalid = !fieldNameInvalid && !filterTypeInvalid && !filterValid;

  return (
    <div className="gf-form-inline">
      <div className="gf-form gf-form-spacing">
        <div className="gf-form-label width-8">Filter type</div>
        <Select
          className="width-8"
          options={[
            { label: 'Include', value: 'include' },
            { label: 'Exclude', value: 'exclude' },
          ]}
          value={config.type}
          onChange={option => {
            // console.log('onChange filterType', option.value);
            onConfigChange({ ...config, type: option.value || 'include' });
          }}
          menuPlacement="bottom"
        />
      </div>
      <div className="gf-form gf-form-spacing">
        <div className="gf-form-label width-8">Rows with</div>
        <Select
          className="width-16"
          placeholder="Field Name"
          options={fieldNameOptions}
          value={config.fieldName}
          invalid={fieldNameInvalid}
          onChange={value => {
            onConfigChange({
              ...config,
              fieldName: value?.value ?? null,
            });
          }}
          isClearable
          menuPlacement="bottom"
        />
      </div>
      <div className="gf-form gf-form-spacing">
        <div className="gf-form-label width-8">Matching</div>
        <Select
          invalid={filterTypeInvalid}
          className="width-8"
          placeholder="Select test"
          options={filterTypeOptions}
          value={config.filterType}
          onChange={value => {
            onConfigChange({ ...config, filterType: (value.value as ValueFilterID) ?? ValueFilterID.regex });
          }}
          menuPlacement="bottom"
        />
      </div>
      <div className="gf-form gf-form--grow gf-form-spacing ">
        {filterInfo.placeholder && (
          <Input
            className="flex-grow-1"
            invalid={filterExpressionInvalid}
            defaultValue={config.filterExpression || undefined}
            placeholder={filterInfo.placeholder}
            onBlur={event => {
              onConfigChange({ ...config, filterExpression: event.currentTarget.value });
            }}
          />
        )}
      </div>
      <div className="gf-form">
        <Button icon="times" onClick={onDelete} style={{ height: '100%' }} size="sm" variant="secondary" />
      </div>
    </div>
  );
};

export const FilterByValueTransformerEditor: React.FC<TransformerUIProps<FilterByValueTransformerOptions>> = ({
  input,
  options,
  onChange,
}) => {
  const fieldNames = useMemo(() => getAllFieldNamesFromDataFrames(input), [input]);
  const fieldNameOptions = useMemo(() => fieldNames.map((item: string) => ({ label: item, value: item })), [
    fieldNames,
  ]);

  const onAddFilter = useCallback(() => {
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
  }, [options]);

  const onDeleteFilter = useCallback(
    (index: number) => () => {
      let valueFilters = cloneDeep(options.valueFilters);
      valueFilters.splice(index, 1);
      onChange({
        ...options,
        valueFilters,
      });
    },
    [options]
  );

  const onConfigChange = useCallback(
    (index: number) => (config: ValueFilter) => {
      let valueFilters = cloneDeep(options.valueFilters);
      valueFilters[index] = config;
      onChange({
        ...options,
        valueFilters: valueFilters as ValueFilter[],
      });
    },
    [options]
  );

  return (
    <div>
      {options.valueFilters.map((val, idx) => {
        const matchingField = getFieldByName(val.fieldName, input);
        return (
          <FilterSelectorRow
            onConfigChange={onConfigChange(idx)}
            onDelete={onDeleteFilter(idx)}
            fieldNameOptions={fieldNameOptions}
            config={val}
            fieldType={matchingField?.type || FieldType.other}
            key={idx}
          />
        );
      })}

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

// Utils functions

// Returns an array of fields that match the fieldName
const getFieldsByName = (fieldName: string, data: DataFrame[]): Field[] => {
  if (!Array.isArray(data) || fieldName === null) {
    return [] as Field[];
  }

  let fieldList = [];

  for (let frame of data) {
    for (let field of frame.fields) {
      if (fieldName === getFieldDisplayName(field, frame, data)) {
        fieldList.push(field);
      }
    }
  }

  return fieldList;
};

// Returns the first field that matches the fieldName or null if none was found
const getFieldByName = (fieldName: string | null, data: DataFrame[]): Field | null => {
  if (fieldName === null) {
    return null;
  }
  let fieldList = getFieldsByName(fieldName, data);
  return fieldList.length > 0 ? fieldList[0] : null;
};
