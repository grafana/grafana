import {
  DataTransformerID,
  standardTransformers,
  TransformerRegistryItem,
  TransformerUIProps,
  TransformerCategory,
} from '@grafana/data';
import { TransposeTransformerOptions } from '@grafana/data/internal';
import { t } from '@grafana/i18n';
import { InlineField, InlineFieldRow, Input } from '@grafana/ui';

import darkImage from '../images/dark/transpose.svg';
import lightImage from '../images/light/transpose.svg';

export const TransposeTransformerEditor = ({ options, onChange }: TransformerUIProps<TransposeTransformerOptions>) => {
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
    </>
  );
};

export const getTransposeTransformerRegistryItem: () => TransformerRegistryItem<TransposeTransformerOptions> = () => ({
  id: DataTransformerID.transpose,
  editor: TransposeTransformerEditor,
  transformation: standardTransformers.transposeTransformer,
  name: t('transformers.transpose-transformer-editor.name.transpose', 'Transpose'),
  description: t(
    'transformers.transpose-transformer-editor.description.transpose-data-frame',
    'Transpose the data frame.'
  ),
  categories: new Set([TransformerCategory.Reformat]),
  tags: new Set([
    t('transformers.transpose-transformer-editor.tags.pivot', 'Pivot'),
    t('transformers.transpose-transformer-editor.tags.translate', 'Translate'),
    t('transformers.transpose-transformer-editor.tags.transform', 'Transform'),
  ]),
  imageDark: darkImage,
  imageLight: lightImage,
});
