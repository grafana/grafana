import React, { useMemo } from 'react';
import {
  DataTransformerID,
  standardTransformers,
  TransformerRegistyItem,
  TransformerUIProps,
  ReducerID,
} from '@grafana/data';
import { getAllFieldNamesFromDataFrames } from './OrganizeFieldsTransformerEditor';
import { Select, StatsPicker, IconButton } from '@grafana/ui';

import {
  GroupByTransformerOptions,
  GroupByOperationID,
  GroupByFieldOptions,
} from '@grafana/data/src/transformations/transformers/groupBy';

function FieldCalculationsSelector(props: any) {
  const { onDelete, onConfigChange, config, fieldName, existsInData } = props;

  let aggregationsSelector = null;

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

  let removeButton = null;
  if (!existsInData) {
    removeButton = (
      <div className="gf-form">
        <div className="gf-form-label">
          <IconButton name="times" size="sm" onClick={onDelete} surface="header" style={{ margin: 0 }} />
        </div>
      </div>
    );
  }

  return (
    <div className="gf-form-inline">
      <div className="gf-form gf-form-spacing">
        <div className="gf-form-label width-16">{fieldName}</div>
      </div>

      <div className="gf-form gf-form-spacing">
        <Select
          className="width-12"
          options={[
            { label: 'Group By', value: GroupByOperationID.groupBy },
            { label: 'Calculate', value: GroupByOperationID.aggregate },
          ]}
          value={config.operation}
          placeholder="Ignored"
          onChange={value => {
            if (value === null) {
              onConfigChange({ ...config, operation: null });
            } else {
              onConfigChange({ ...config, operation: value.value });
            }
          }}
          isClearable
          menuPlacement="bottom"
        />
      </div>

      {aggregationsSelector}

      {removeButton}
    </div>
  );
}

export const GroupByTransformerEditor: React.FC<TransformerUIProps<GroupByTransformerOptions>> = ({
  input,
  options,
  onChange,
}) => {
  const fieldNames = useMemo(() => getAllFieldNamesFromDataFrames(input), [input]);

  let fields = { ...options.fields }; // Current configuration
  // fields = fields.filter((val) => fieldNames.include()) // Remove the fields that are not present anymore

  for (let n of fieldNames) {
    if (!(n in fields)) {
      // If there is a new field in the data, we add it to the configuration
      fields[n] = {
        aggregations: [],
        operation: null,
      };
    }
  }

  const onDeleteFieldCalculations = (fieldName: string) => () => {
    delete fields[fieldName];
    onChange({
      ...options,
      fields: {
        ...fields,
      },
    });
  };

  const onConfigChange = (fieldName: string) => (config: GroupByFieldOptions) => {
    onChange({
      ...options,
      fields: {
        ...options.fields,
        [fieldName]: config,
      },
    });
  };

  return (
    <div>
      <div className="gf-form-inline">
        <div className="gf-form gf-form-spacing">
          <div className="gf-form-label width-16">Field Name</div>
        </div>
        <div className="gf-form gf-form-spacing">
          <div className="gf-form-label width-12">Operation</div>
        </div>
        <div className="gf-form gf-form-spacing gf-form--grow">
          <div className="gf-form-label flex-grow-1">Calculations</div>
        </div>
      </div>

      {Object.keys(fields)
        .sort()
        .map((key: string) => (
          <FieldCalculationsSelector
            onConfigChange={onConfigChange(key)}
            onDelete={onDeleteFieldCalculations(key)}
            existsInData={fieldNames.includes(key)}
            fieldName={key}
            config={fields[key]}
            key={key}
          />
        ))}
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
