import React, { useMemo } from 'react';
import {
  DataTransformerID,
  SelectableValue,
  standardTransformers,
  TransformerRegistyItem,
  TransformerUIProps,
  ReducerID,
} from '@grafana/data';
import { getAllFieldNamesFromDataFrames } from './OrganizeFieldsTransformerEditor';
import { Select, StatsPicker, Button, IconButton } from '@grafana/ui';
import { selectors } from '@grafana/e2e-selectors';

import { GroupByTransformerOptions } from '@grafana/data/src/transformations/transformers/groupBy';

function FieldCalculationsSelector(props: any) {
  const { fieldNameOptions, onDelete, onConfigChange, config } = props;

  return (
    <div className="gf-form-inline">
      <div className="gf-form gf-form-spacing">
        <div className="gf-form-label width-8">On field</div>
        <Select
          className="width-16"
          placeholder="Field Name"
          options={
            config[0] === null ? fieldNameOptions : [{ label: config[0], value: config[0] }, ...fieldNameOptions]
          }
          value={config[0]}
          onChange={value => {
            if (value === null) {
              onConfigChange([null, config[1]]);
            } else {
              onConfigChange([value.value || null, config[1]]);
            }
          }}
          isClearable
          menuPlacement="bottom"
        />
      </div>
      <div className="gf-form gf-form--grow gf-form-spacing">
        <div className="gf-form-label width-8" aria-label={selectors.components.Transforms.Reduce.calculationsLabel}>
          Calculate
        </div>
        <StatsPicker
          className="flex-grow-1"
          placeholder="Choose Stat"
          allowMultiple
          stats={config[1]}
          onChange={stats => {
            onConfigChange([config[0], stats as ReducerID[]]);
          }}
          menuPlacement="bottom"
        />
      </div>
      <div className="gf-form">
        <div className="gf-form-label">
          <IconButton name="times" size="sm" onClick={onDelete} surface="header" />
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
  const fieldNameOptions = fieldNames.map((item: string) => ({ label: item, value: item }));
  const usedFieldNames = options.calculationsByField.map(item => item[0]);
  const unusedFieldNameOptions = fieldNames
    .filter(name => !usedFieldNames.includes(name))
    .map((item: string) => ({ label: item, value: item }));

  const onSelectField = (value: SelectableValue<string>) => {
    onChange({
      ...options,
      byFields: value.map(i => i.value),
    });
  };

  const onAddFieldCalculations = () => {
    onChange({
      ...options,
      calculationsByField: [...options.calculationsByField, [null, []]],
    });
  };

  const onDeleteFieldCalculations = (index: number) => () => {
    options.calculationsByField.splice(index, 1);
    onChange({
      ...options,
    });
  };

  const onConfigChange = (index: number) => (config: [string | any, ReducerID[]]) => {
    options.calculationsByField[index] = config; // If the calculationsByField in defaultOptions is not empty, we should make a deep copy here
    onChange({
      ...options,
      calculationsByField: [...options.calculationsByField],
    });
  };

  return (
    <div>
      <div className="gf-form-inline">
        <div className="gf-form gf-form-spacing">
          <div className="gf-form-label width-8">Group by</div>
          <Select
            className="width-16"
            options={fieldNameOptions}
            value={options.byFields.map(i => ({ value: i, label: i }))}
            onChange={onSelectField}
            isClearable
            isMulti
            placeholder="Field Name"
            menuPlacement="bottom"
          />
        </div>
        <div className="gf-form">
          <Button
            icon="plus"
            onClick={onAddFieldCalculations}
            variant="secondary"
            disabled={options.calculationsByField.length >= fieldNameOptions.length}
          >
            Add field aggregation
          </Button>
        </div>
      </div>

      {options.calculationsByField.map((val, idx) => (
        <FieldCalculationsSelector
          onConfigChange={onConfigChange(idx)}
          onDelete={onDeleteFieldCalculations(idx)}
          fieldNameOptions={unusedFieldNameOptions}
          config={val}
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
