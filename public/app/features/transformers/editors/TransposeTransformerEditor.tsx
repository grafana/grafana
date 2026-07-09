import { type TransformerUIProps, type SpecialValue, type SelectableValue } from '@grafana/data';
import { type TransposeTransformerOptions } from '@grafana/data/internal';
import { t } from '@grafana/i18n';
import { InlineField, InlineFieldRow, Input, Select } from '@grafana/ui';

import { getEmptyOptions } from '../utils';

export const TransposeTransformerEditor = ({ options, onChange }: TransformerUIProps<TransposeTransformerOptions>) => {
  const onSelectEmptyValue = (value?: SelectableValue<SpecialValue>) => {
    onChange({
      ...options,
      emptyValue: value?.value,
    });
  };

  return (
    <>
      <InlineFieldRow>
        <InlineField
          label={t('transformers.transpose-transfomer-editor.label-first-field-name', 'First field name')}
          labelWidth={24}
        >
          <Input
            placeholder={t('transformers.transpose-transfomer-editor.placeholder-field', 'Field')}
            value={options.firstFieldName}
            onChange={(e) => onChange({ ...options, firstFieldName: e.currentTarget.value })}
            width={25}
          />
        </InlineField>
      </InlineFieldRow>
      <InlineFieldRow>
        <InlineField
          label={t('transformers.transpose-transfomer-editor.label-remaining-fields-name', 'Remaining fields name')}
          tooltip={t('transformers.transpose-transfomer-editor.tooltip-name-for-value-fields', 'Name for value fields')}
          labelWidth={24}
        >
          <Input
            placeholder={t('transformers.transpose-transfomer-editor.placeholder-value', 'Value')}
            value={options.restFieldsName}
            onChange={(e) => onChange({ ...options, restFieldsName: e.currentTarget.value })}
            width={25}
          />
        </InlineField>
      </InlineFieldRow>
      <InlineFieldRow>
        <InlineField label={t('transformers.grouping-to-matrix-transformer-editor.label-empty-value', 'Empty value')}>
          <Select options={getEmptyOptions()} value={options.emptyValue} onChange={onSelectEmptyValue} isClearable />
        </InlineField>
      </InlineFieldRow>
    </>
  );
};
