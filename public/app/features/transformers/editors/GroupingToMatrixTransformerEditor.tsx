import { useCallback } from 'react';

import {
  type SelectableValue,
  type TransformerUIProps,
  type GroupingToMatrixTransformerOptions,
  type SpecialValue,
} from '@grafana/data';
import { t } from '@grafana/i18n';
import { getTemplateSrv } from '@grafana/runtime';
import { InlineField, InlineFieldRow, Select } from '@grafana/ui';

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
