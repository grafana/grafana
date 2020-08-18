import React, { useMemo } from 'react';
import {
  DataTransformerID,
  standardTransformers,
  TransformerRegistyItem,
  TransformerUIProps,
  ReducerID,
} from '@grafana/data';
import { getAllFieldNamesFromDataFrames } from './OrganizeFieldsTransformerEditor';
import { Select, StatsPicker, Button, IconButton } from '@grafana/ui';

import {
  GroupByTransformerOptions,
  GroupByOperationID,
  GroupByFieldOptions,
} from '@grafana/data/src/transformations/transformers/groupBy';

function FieldCalculationsSelector(props: any) {
  const { fieldNameOptions, onDelete, onConfigChange, config } = props;

  let operationSelector = null;
  let aggregationsSelector = null;

  if (config.fieldName) {
    operationSelector = (
      <div className="gf-form gf-form-spacing">
        <Select
          className="width-12"
          options={[
            { label: 'Group By', value: GroupByOperationID.groupBy },
            { label: 'Calculate', value: GroupByOperationID.aggregate },
          ]}
          value={config.operation}
          onChange={value => {
            onConfigChange({ ...config, operation: value.value });
          }}
          menuPlacement="bottom"
        />
      </div>
    );

    if (config.operation === GroupByOperationID.aggregate) {
      aggregationsSelector = (
        <div className="gf-form gf-form-spacing gf-form--grow">
          <StatsPicker
            className="flex-grow-1"
            placeholder="Select Stats"
            allowMultiple
            stats={config.aggregations}
            onChange={stats => {
              onConfigChange({ ...config, aggregations: stats as ReducerID[] });
            }}
            menuPlacement="bottom"
          />
        </div>
      );
    }
  }

  return (
    <div className="gf-form-inline">
      <div className="gf-form gf-form-spacing">
        <div className="gf-form-label width-4">For Field</div>
        <Select
          className="width-12"
          placeholder="Field Name"
          options={
            config.fieldName === null
              ? fieldNameOptions
              : [{ label: config.fieldName, value: config.fieldName }, ...fieldNameOptions]
          }
          value={config.fieldName}
          onChange={value => {
            if (value === null) {
              onConfigChange({ ...config, fieldName: null });
            } else {
              onConfigChange({ ...config, fieldName: value.value || null });
            }
          }}
          isClearable
          menuPlacement="bottom"
        />
      </div>

      {operationSelector}

      {aggregationsSelector}

      <div className="gf-form">
        <div className="gf-form-label">
          <IconButton name="times" size="sm" onClick={onDelete} surface="header" style={{ margin: 0 }} />
        </div>
      </div>
    </div>
  );
}

export const GroupByTransformerEditor: React.FC<TransformerUIProps<GroupByTransformerOptions>> = ({
  input,
  options,
  onChange,
}) => {
  const fieldNames = useMemo(() => getAllFieldNamesFromDataFrames(input), [input]);
  // const fieldNameOptions = fieldNames.map((item: string) => ({ label: item, value: item }));
  const usedFieldNames = options.fieldsArray.map(item => item.fieldName);
  const unusedFieldNameOptions = fieldNames
    .filter(name => !usedFieldNames.includes(name))
    .map((item: string) => ({ label: item, value: item }));

  const onAddFieldCalculations = () => {
    let operation = usedFieldNames.length > 0 ? GroupByOperationID.aggregate : GroupByOperationID.groupBy;

    onChange({
      ...options,
      fieldsArray: [...options.fieldsArray, { fieldName: null, aggregations: [], operation }],
    });
  };

  const onDeleteFieldCalculations = (index: number) => () => {
    options.fieldsArray.splice(index, 1);
    onChange({
      ...options,
    });
  };

  const onConfigChange = (index: number) => (config: GroupByFieldOptions) => {
    options.fieldsArray[index] = config;

    options.fieldsArray.sort((a, b) => {
      if (a.operation !== b.operation) {
        if (a.operation === GroupByOperationID.groupBy) {
          return -1;
        } else {
          return 1;
        }
      } else {
        return 0;
      }
    });

    onChange({
      ...options,
      fieldsArray: [...options.fieldsArray],
    });
  };

  return (
    <div>
      {options.fieldsArray.map((val, idx) => (
        <FieldCalculationsSelector
          onConfigChange={onConfigChange(idx)}
          onDelete={onDeleteFieldCalculations(idx)}
          fieldNameOptions={unusedFieldNameOptions}
          config={val}
        />
      ))}

      <div className="gf-form-inline">
        <div className="gf-form">
          <Button
            icon="plus"
            onClick={onAddFieldCalculations}
            variant="secondary"
            disabled={options.fieldsArray.length >= fieldNames.length}
          >
            Add field
          </Button>
        </div>
      </div>
    </div>
  );
};

export const groupByTransformRegistryItem: TransformerRegistyItem<GroupByTransformerOptions> = {
  id: DataTransformerID.groupBy,
  editor: GroupByTransformerEditor,
  transformation: standardTransformers.groupByTransformer,
  name: standardTransformers.groupByTransformer.name,
  description: standardTransformers.groupByTransformer.description,
};
