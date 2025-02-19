import { useCallback } from 'react';

import {
  DataTransformerID,
  SelectableValue,
  standardTransformers,
  TransformerRegistryItem,
  TransformerUIProps,
  GroupingToMatrixTransformerOptions,
  SpecialValue,
  TransformerCategory,
} from '@grafana/data';
import { getTemplateSrv } from '@grafana/runtime';
import { InlineField, InlineFieldRow, Select } from '@grafana/ui';

import { getTransformationContent } from '../docs/getTransformationContent';
import { useAllFieldNamesFromDataFrames } from '../utils';

export const GroupingToMatrixTransformerEditor = ({
  input,
  options,
  onChange,
}: TransformerUIProps<GroupingToMatrixTransformerOptions>) => {
  const fieldNames = useAllFieldNamesFromDataFrames(input).map((item: string) => ({ label: item, value: item }));
  const variables = getTemplateSrv()
    .getVariables()
    .map((v) => {
      return { value: '$' + v.name, label: '$' + v.name };
    });

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
    { label: 'Zero', value: SpecialValue.Zero, description: 'Number 0 value' },
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
          <Select
            options={[...fieldNames, ...variables]}
            value={options.columnField}
            onChange={onSelectColumn}
            isClearable
          />
        </InlineField>
        <InlineField label="Row" labelWidth={8}>
          <Select options={[...fieldNames, ...variables]} value={options.rowField} onChange={onSelectRow} isClearable />
        </InlineField>
        <InlineField label="Cell Value" labelWidth={10}>
          <Select
            options={[...fieldNames, ...variables]}
            value={options.valueField}
            onChange={onSelectValue}
            isClearable
          />
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
  name: standardTransformers.groupingToMatrixTransformer.name,
  description: 'Takes a three fields combination and produces a Matrix.',
  categories: new Set([TransformerCategory.Combine, TransformerCategory.Reformat]),
  help: getTransformationContent(DataTransformerID.groupingToMatrix).helperDocs,
};
