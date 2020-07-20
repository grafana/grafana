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
import { Select, StatsPicker, Button } from '@grafana/ui';
import { selectors } from '@grafana/e2e-selectors';

import { OccurrencesTransformerOptions } from '@grafana/data/src/transformations/transformers/occurrences';

function FieldCalculationsSelector(props: any) {
  const { fieldNameOptions, onDelete, onConfigChange, config } = props;

  return (
    <div className="gf-form-inline">
      <div className="gf-form">
        <div className="gf-form-label width-8">On field</div>
        <Select
          className="width-16"
          placeholder="Field Name"
          options={fieldNameOptions}
          value={config[0]}
          onChange={value => {
            console.log('onChange', value);
            console.log(onConfigChange([value.value, config[1]]));
          }}
          isClearable
          menuPlacement="bottom"
        />
      </div>
      <div className="gf-form gf-form--grow gf-form--offset-1">
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
      <Button icon="trash-alt" onClick={onDelete} size="sm" variant="secondary" />
    </div>
  );
}

export const OccurrencesTransformerEditor: React.FC<TransformerUIProps<OccurrencesTransformerOptions>> = ({
  input,
  options,
  onChange,
}) => {
  const fieldNames = useMemo(() => getAllFieldNamesFromDataFrames(input), [input]);
  const fieldNameOptions = fieldNames.map((item: string) => ({ label: item, value: item }));

  const onSelectField = (value: SelectableValue<string>) => {
    onChange({
      ...options,
      byField: value.value,
    });
  };

  const onAddFieldCalculations = () => {
    options.calculationsByField.push([null, []]);
    onChange({
      ...options,
    });
  };

  const onDeleteFieldCalculations = (index: number) => () => {
    options.calculationsByField.splice(index, 1);
    onChange({
      ...options,
    });
  };

  const onConfigChange = (index: number) => (config: [string | any, ReducerID[]]) => {
    console.log('onConfigChange', index, config, options);
    options.calculationsByField[index] = config;
    console.log(options);
    onChange({
      ...options,
    });
  };

  return (
    <div>
      <div className="gf-form-inline">
        <div className="gf-form">
          <div className="gf-form-label width-8">Group by</div>
          <Select
            className="width-16"
            options={fieldNameOptions}
            value={options.byField}
            onChange={onSelectField}
            isClearable
            placeholder="Field Name"
            menuPlacement="bottom"
          />
        </div>
      </div>

      {options.calculationsByField.map((val, idx) => (
        <FieldCalculationsSelector
          onConfigChange={onConfigChange(idx)}
          onDelete={onDeleteFieldCalculations(idx)}
          fieldNameOptions={fieldNameOptions}
          config={val}
        />
      ))}

      <div className="gf-form-inline gf-form--offset-1">
        <Button icon="plus" onClick={onAddFieldCalculations}>
          Add Field Calculations
        </Button>
      </div>
    </div>
  );
};

export const occurrencesTransformRegistryItem: TransformerRegistyItem<OccurrencesTransformerOptions> = {
  id: DataTransformerID.occurrences,
  editor: OccurrencesTransformerEditor,
  transformation: standardTransformers.occurrencesTransformer,
  name: standardTransformers.occurrencesTransformer.name,
  description: standardTransformers.occurrencesTransformer.description,
};
