import {
  DataTransformerID,
  standardTransformers,
  TransformerRegistryItem,
  TransformerUIProps,
  TransformerCategory,
  SelectableValue,
} from '@grafana/data';
import { FieldNameMappingTransformerOptions } from '@grafana/data/internal';
import { t } from '@grafana/i18n';
import { Combobox, InlineField, InlineFieldRow } from '@grafana/ui';
import { FieldNamePicker } from '@grafana/ui/internal';

import { getTransformationContent } from '../docs/getTransformationContent';

interface Props extends TransformerUIProps<FieldNameMappingTransformerOptions> {}

const fieldNamePickerSettings = {
  editor: FieldNamePicker,
  id: '',
  name: '',
  settings: { width: 24, isClearable: false },
};

export function FieldNameMappingTransformerEditor({ input, onChange, options }: Props) {
  const refIds = input
    .map((x) => x.refId)
    .filter((x) => x != null)
    .map((x) => ({ label: x, value: x }));

  const currentRefId = options.configRefId;
  const configFrame = input.find((x) => x.refId === currentRefId);
  const soloConfigFrame = configFrame ? [configFrame] : [];

  const from = configFrame?.fields.find((e) => e.name === options.from)?.values;
  const to = configFrame?.fields.find((e) => e.name === options.to)?.values;

  const mapping = from && to ? from.map((from, i) => [`${from}`, `${to[i]}`]) : [];

  const onRefIdChange = (value: SelectableValue<string>) => {
    onChange({
      ...options,
      configRefId: value.value ?? options.configRefId,
    });
  };

  const onPickFromField = (value?: string) => {
    onChange({
      ...options,
      from: value ?? options.from,
    });
  };

  const onPickToField = (value?: string) => {
    onChange({
      ...options,
      to: value ?? options.to,
    });
  };

  return (
    <>
      <InlineFieldRow>
        <InlineField
          label={t('transformers.field-name-mapping-transformer-editor.label-mapping-query', 'Mapping query')}
          labelWidth={20}
        >
          <Combobox onChange={onRefIdChange} options={refIds} value={currentRefId} width={30} />
        </InlineField>
      </InlineFieldRow>

      {configFrame && (
        <>
          <InlineFieldRow>
            <InlineField
              label={t('transformers.field-name-mapping-transformer-editor.label-field-to-replace', 'Field to replace')}
              labelWidth={20}
            >
              <FieldNamePicker
                context={{ data: soloConfigFrame }}
                value={options?.from ?? ''}
                onChange={onPickFromField}
                item={fieldNamePickerSettings}
              />
            </InlineField>
          </InlineFieldRow>

          <InlineFieldRow>
            <InlineField
              label={t('transformers.field-name-mapping-transformer-editor.label-replace-with', 'Replace with')}
              labelWidth={20}
            >
              <FieldNamePicker
                context={{ data: soloConfigFrame }}
                value={options?.to ?? ''}
                onChange={onPickToField}
                item={fieldNamePickerSettings}
              />
            </InlineField>
          </InlineFieldRow>
        </>
      )}

      {mapping.slice(0, 10).map(([from, to]) => (
        <InlineFieldRow key={from}>
          {from} - {to}
        </InlineFieldRow>
      ))}
    </>
  );
}

export const fieldNameMappingRegistryItem: TransformerRegistryItem<FieldNameMappingTransformerOptions> = {
  id: DataTransformerID.fieldNameMapping,
  editor: FieldNameMappingTransformerEditor,
  transformation: standardTransformers.fieldNameMappingTransformer,
  name: standardTransformers.fieldNameMappingTransformer.name,
  description: 'Renames field of query based on the result of another query.',
  categories: new Set([TransformerCategory.ReorderAndRename]),
  help: getTransformationContent(DataTransformerID.fieldNameMapping).helperDocs,
};
