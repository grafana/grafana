import React, { useCallback } from 'react';

import {
  DataTransformerID,
  SelectableValue,
  standardTransformers,
  TransformerRegistryItem,
  TransformerUIProps,
  GroupingToMatrixTransformerOptions,
  SpecialValue,
} from '@grafana/data';
import { InlineField, InlineFieldRow, Select } from '@grafana/ui';

import { useAllFieldNamesFromDataFrames } from '../utils';

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
        columnField: value?.value,
      });
    },
    [onChange, options]
  );

  const onSelectRow = useCallback(
    (value: SelectableValue<string>) => {
      onChange({
        ...options,
        rowField: value?.value,
      });
    },
    [onChange, options]
  );

  const onSelectValue = useCallback(
    (value: SelectableValue<string>) => {
      onChange({
        ...options,
        valueField: value?.value,
      });
    },
    [onChange, options]
  );

  const specialValueOptions: Array<SelectableValue<SpecialValue>> = [
    { label: 'Null', value: SpecialValue.Null, description: 'Null value' },
    { label: 'True', value: SpecialValue.True, description: 'Boolean true value' },
    { label: 'False', value: SpecialValue.False, description: 'Boolean false value' },
    { label: 'Empty', value: SpecialValue.Empty, description: 'Empty string' },
  ];

  const onSelectEmptyValue = useCallback(
    (value: SelectableValue<SpecialValue>) => {
      onChange({
        ...options,
        emptyValue: value?.value,
      });
    },
    [onChange, options]
  );

  return (
    <>
      <InlineFieldRow>
        <InlineField label="Column" labelWidth={8}>
          <Select options={fieldNames} value={options.columnField} onChange={onSelectColumn} isClearable />
        </InlineField>
        <InlineField label="Row" labelWidth={8}>
          <Select options={fieldNames} value={options.rowField} onChange={onSelectRow} isClearable />
        </InlineField>
        <InlineField label="Cell Value" labelWidth={10}>
          <Select options={fieldNames} value={options.valueField} onChange={onSelectValue} isClearable />
        </InlineField>
        <InlineField label="Empty Value">
          <Select options={specialValueOptions} value={options.emptyValue} onChange={onSelectEmptyValue} isClearable />
        </InlineField>
      </InlineFieldRow>
    </>
  );
};

export const groupingToMatrixTransformRegistryItem: TransformerRegistryItem<GroupingToMatrixTransformerOptions> = {
  id: DataTransformerID.groupingToMatrix,
  editor: GroupingToMatrixTransformerEditor,
  transformation: standardTransformers.groupingToMatrixTransformer,
  name: 'Grouping to matrix',
  description: `Takes a three fields combination and produces a Matrix`,
};
