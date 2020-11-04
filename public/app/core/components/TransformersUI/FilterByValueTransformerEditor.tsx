import React, { useMemo, useCallback, useState } from 'react';
import { css } from 'emotion';
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
  valueMatchers,
  MatcherConfig,
} from '@grafana/data';
import { Select, Button, RadioButtonGroup, stylesFactory } from '@grafana/ui';
import cloneDeep from 'lodash/cloneDeep';
import {
  FilterByValueTransformerOptions,
  ValueFilter,
} from '@grafana/data/src/transformations/transformers/filterByValue';

import { ValueFilterID } from '@grafana/data/src/transformations/valueFilters';

interface RowProps {
  fieldNameOptions: Array<SelectableValue<string>>;
  onDelete: () => void;
  onConfigChange: (config: ValueFilter) => void;
  filter: ValueFilter;
  field: Field;
}

const getFilterConfigEditor = (id: ValueFilterID): React.FC<EditorProps> | null => {
  // TODO: return editor that creates a valueMatcherConfig.
  switch (id) {
    case ValueFilterID.isNull:
      return null;
    default:
      return null;
  }
};

interface EditorProps {
  config: MatcherConfig;
  onChange: (config: MatcherConfig) => void;
}

const FilterSelectorRow: React.FC<RowProps> = props => {
  const { fieldNameOptions, onDelete, onConfigChange, filter, field } = props;
  const Editor = getFilterConfigEditor(filter.config?.id as ValueFilterID);
  // Find filter types that fit the chosen field type
  const filterTypeOptions = useMemo(() => {
    const options = [];

    for (const matcher of valueMatchers.list()) {
      if (!matcher.isApplicable(field)) {
        continue;
      }

      const editor = getFilterConfigEditor(matcher.id as ValueFilterID);
      if (!editor) {
        continue;
      }

      options.push({
        value: matcher.id,
        label: matcher.name,
        description: matcher.description,
      });
    }

    return options;
  }, [field]);

  return (
    <div className="gf-form-inline">
      <div className="gf-form gf-form-spacing">
        <div className="gf-form-label width-4">Field</div>
        <Select
          className="width-24"
          placeholder="Field Name"
          options={fieldNameOptions}
          value={filter.fieldName}
          onChange={value => {
            if (!value?.value) {
              return;
            }

            onConfigChange({
              ...filter,
              fieldName: value.value,
            });
          }}
          isClearable
          menuPlacement="bottom"
        />
      </div>
      <div className="gf-form gf-form-spacing">
        <div className="gf-form-label width-8">Match</div>
        <Select
          className="width-8"
          placeholder="Select test"
          options={filterTypeOptions}
          value={filter.config.id}
          onChange={value => {
            if (!value?.value) {
              return;
            }
            onConfigChange({ ...filter, config: { id: value.value } });
          }}
          menuPlacement="bottom"
        />
      </div>
      <div className="gf-form gf-form--grow gf-form-spacing ">
        {Editor && <Editor config={filter.config} onChange={config => onConfigChange({ ...filter, config })} />}
      </div>
      <div className="gf-form">
        <Button icon="times" onClick={onDelete} style={{ height: '100%' }} size="sm" variant="secondary" />
      </div>
    </div>
  );
};

export const FilterByValueTransformerEditor: React.FC<TransformerUIProps<FilterByValueTransformerOptions>> = props => {
  const { input, options, onChange } = props;
  const styles = getEditorStyles();
  const fieldsInfo = useMemo(() => getAllFieldInfoFromDataFrames(input), [input]);
  const fieldNameOptions = useMemo(
    () =>
      fieldsInfo
        .filter((item: Record<string, any>) => item.type !== FieldType.time)
        .map((item: Record<string, any>) => ({ label: item.name, value: item.name })),
    [fieldsInfo]
  );

  const onAddFilter = useCallback(() => {
    let filters = cloneDeep(options.filters);
    filters.push({
      fieldName: '',
      config: {
        id: ValueFilterID.regex,
      },
    });
    onChange({ ...options, filters });
  }, [onChange, options]);

  const onDeleteFilter = useCallback(
    (index: number) => () => {
      let filters = cloneDeep(options.filters);
      filters.splice(index, 1);
      onChange({ ...options, filters });
    },
    [options, onChange]
  );

  const onConfigChange = useCallback(
    (index: number) => (config: ValueFilter) => {
      let filters = cloneDeep(options.filters);
      filters[index] = config;
      onChange({ ...options, filters });
    },
    [options, onChange]
  );

  return (
    <div>
      <div className="gf-form gf-form-inline">
        <div className="gf-form-label">Filter type</div>
        <RadioButtonGroup
          options={[
            { label: 'Include values', value: 'include' },
            { label: 'Exclude values', value: 'exclude' },
          ]}
          value={options.type}
          onChange={option => {
            onChange({ ...options, type: option || 'include' });
          }}
        />
      </div>
      <div className="gf-form gf-form-inline">
        <div className="gf-form-label gf-form--grow">Conditions</div>
        <RadioButtonGroup
          options={[
            { label: 'Match all', value: 'all' },
            { label: 'Match any', value: 'any' },
          ]}
          value={options.match}
          onChange={option => {
            onChange({ ...options, match: option || 'all' });
          }}
        />
      </div>
      <div className={styles.conditions}>
        {options.filters.map((filter, idx) => {
          const matchingField = getFieldByName(filter.fieldName, input);

          if (!matchingField) {
            return null;
          }

          return (
            <FilterSelectorRow
              onConfigChange={onConfigChange(idx)}
              onDelete={onDeleteFilter(idx)}
              fieldNameOptions={fieldNameOptions}
              filter={filter}
              field={matchingField}
              key={idx}
            />
          );
        })}
        <div className="gf-form">
          <Button icon="plus" size="sm" onClick={onAddFilter} variant="secondary">
            Add condition
          </Button>
        </div>
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

const getEditorStyles = stylesFactory(() => ({
  conditions: css`
    padding-left: 16px;
  `,
}));

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

const getAllFieldInfoFromDataFrames = (input: DataFrame[]): Array<Record<string, any>> => {
  if (!Array.isArray(input)) {
    return [];
  }

  let fieldList = [];
  for (let frame of input) {
    for (let field of frame.fields) {
      fieldList.push({
        name: getFieldDisplayName(field, frame, input),
        type: field.type,
      });
    }
  }

  return fieldList;
};
