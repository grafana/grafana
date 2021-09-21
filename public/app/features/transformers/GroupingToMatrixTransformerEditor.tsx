import React, { useCallback } from 'react';
import {
  DataTransformerID,
  SelectableValue,
  standardTransformers,
  TransformerRegistryItem,
  TransformerUIProps,
} from '@grafana/data';
import { Select } from '@grafana/ui';
import { GroupingToMatrixTransformerOptions } from '@grafana/data/src/transformations/transformers/groupingToMatrix';
import { useAllFieldNamesFromDataFrames } from './utils';

export const GroupingToMatrixTransformerEditor: React.FC<TransformerUIProps<GroupingToMatrixTransformerOptions>> = ({
  input,
  options,
  onChange,
}) => {
  const fieldNames = useAllFieldNamesFromDataFrames(input).map((item: string) => ({ label: item, value: item }));

  const onSelectColumn = useCallback(
    (value: SelectableValue<string>) => {
      onChange({
        ...options,
        columnField: value.value,
      });
    },
    [onChange, options]
  );

  const onSelectRow = useCallback(
    (value: SelectableValue<string>) => {
      onChange({
        ...options,
        rowField: value.value,
      });
    },
    [onChange, options]
  );

  const onSelectValue = useCallback(
    (value: SelectableValue<string>) => {
      onChange({
        ...options,
        valueField: value.value,
      });
    },
    [onChange, options]
  );

  return (
    <div className="gf-form-inline">
      <div className="gf-form gf-form--grow">
        <div className="gf-form-label width-8">Column</div>
        <Select
          menuShouldPortal
          options={fieldNames}
          value={options.columnField}
          onChange={onSelectColumn}
          isClearable
        />
      </div>
      <div className="gf-form gf-form--grow">
        <div className="gf-form-label width-8">Row</div>
        <Select menuShouldPortal options={fieldNames} value={options.rowField} onChange={onSelectRow} isClearable />
      </div>
      <div className="gf-form gf-form--grow">
        <div className="gf-form-label width-8">Cell Value</div>
        <Select menuShouldPortal options={fieldNames} value={options.valueField} onChange={onSelectValue} isClearable />
      </div>
    </div>
  );
};

export const groupingToMatrixTransformerRegistryItem: TransformerRegistryItem<GroupingToMatrixTransformerOptions> = {
  id: DataTransformerID.groupingToMatrix,
  editor: GroupingToMatrixTransformerEditor,
  transformation: standardTransformers.groupingToMatrixTransformer,
  name: 'Grouping to matrix',
  description: `Takes a three fields combination and produces a Matrix`,
};
