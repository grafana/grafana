import React, { useMemo, useCallback } from 'react';
import {
  DataTransformerID,
  standardTransformers,
  TransformerRegistyItem,
  TransformerUIProps,
  ReducerID,
  SelectableValue,
} from '@grafana/data';
import { getAllFieldNamesFromDataFrames } from './OrganizeFieldsTransformerEditor';
import { Select, StatsPicker } from '@grafana/ui';

import {
  GroupByTransformerOptions,
  GroupByOperationID,
  GroupByFieldOptions,
} from '@grafana/data/src/transformations/transformers/groupBy';

interface FieldProps {
  fieldName: string;
  config?: GroupByFieldOptions;
  onConfigChange: (config: GroupByFieldOptions) => void;
}

export const GroupByTransformerEditor: React.FC<TransformerUIProps<GroupByTransformerOptions>> = ({
  input,
  options,
  onChange,
}) => {
  const fieldNames = useMemo(() => getAllFieldNamesFromDataFrames(input), [input]);

  const onConfigChange = useCallback(
    (fieldName: string) => (config: GroupByFieldOptions) => {
      onChange({
        ...options,
        fields: {
          ...options.fields,
          [fieldName]: config,
        },
      });
    },
    [options]
  );

  return (
    <div>
      {fieldNames.map((key: string) => (
        <GroupByFieldConfiguration
          onConfigChange={onConfigChange(key)}
          fieldName={key}
          config={options.fields[key]}
          key={key}
        />
      ))}
    </div>
  );
};

const options = [
  { label: 'Group By', value: GroupByOperationID.groupBy },
  { label: 'Calculate', value: GroupByOperationID.aggregate },
];

export const GroupByFieldConfiguration: React.FC<FieldProps> = ({ fieldName, config, onConfigChange }) => {
  const onChange = useCallback(
    (value: SelectableValue<GroupByOperationID | null>) => {
      onConfigChange({
        aggregations: config?.aggregations ?? [],
        operation: value?.value ?? null,
      });
    },
    [config, onConfigChange]
  );

  return (
    <div className="gf-form-inline">
      <div className="gf-form">
        <div className="gf-form-label width-30">{fieldName}</div>
      </div>

      <div className="gf-form gf-form-spacing">
        <Select
          className="width-12"
          options={options}
          value={config?.operation}
          placeholder="Ignored"
          onChange={onChange}
          isClearable
          menuPlacement="bottom"
        />
      </div>

      {config?.operation === GroupByOperationID.aggregate && (
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
      )}
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
