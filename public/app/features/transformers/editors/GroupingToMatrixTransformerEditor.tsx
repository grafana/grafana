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
import { t } from '@grafana/i18n';
import { getTemplateSrv } from '@grafana/runtime';
import { InlineField, InlineFieldRow, Select } from '@grafana/ui';

import { getTransformationContent } from '../docs/getTransformationContent';
import darkImage from '../images/dark/groupingToMatrix.svg';
import lightImage from '../images/light/groupingToMatrix.svg';
import { getEmptyOptions, useAllFieldNamesFromDataFrames } from '../utils';

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
        <InlineField
          label={t('transformers.grouping-to-matrix-transformer-editor.label-column', 'Column')}
          labelWidth={8}
        >
          <Select
            options={[...fieldNames, ...variables]}
            value={options.columnField}
            onChange={onSelectColumn}
            isClearable
          />
        </InlineField>
        <InlineField label={t('transformers.grouping-to-matrix-transformer-editor.label-row', 'Row')} labelWidth={8}>
          <Select options={[...fieldNames, ...variables]} value={options.rowField} onChange={onSelectRow} isClearable />
        </InlineField>
        <InlineField
          label={t('transformers.grouping-to-matrix-transformer-editor.label-cell-value', 'Cell value')}
          labelWidth={10}
        >
          <Select
            options={[...fieldNames, ...variables]}
            value={options.valueField}
            onChange={onSelectValue}
            isClearable
          />
        </InlineField>
        <InlineField label={t('transformers.grouping-to-matrix-transformer-editor.label-empty-value', 'Empty value')}>
          <Select options={getEmptyOptions()} value={options.emptyValue} onChange={onSelectEmptyValue} isClearable />
        </InlineField>
      </InlineFieldRow>
    </>
  );
};

export const getGroupingToMatrixTransformRegistryItem: () => TransformerRegistryItem<GroupingToMatrixTransformerOptions> =
  () => ({
    id: DataTransformerID.groupingToMatrix,
    editor: GroupingToMatrixTransformerEditor,
    transformation: standardTransformers.groupingToMatrixTransformer,
    name: t('transformers.grouping-to-matrix-transformer-editor.name.grouping-to-matrix', 'Grouping to matrix'),
    description: t(
      'transformers.grouping-to-matrix-transformer-editor.description.summarize-and-reorganize-data',
      'Summarize and reorganize data based on three fields.'
    ),
    categories: new Set([TransformerCategory.Combine, TransformerCategory.Reformat]),
    help: getTransformationContent(DataTransformerID.groupingToMatrix).helperDocs,
    imageDark: darkImage,
    imageLight: lightImage,
  });
