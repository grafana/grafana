import { useCallback, ChangeEvent } from 'react';

import {
  DataTransformerID,
  standardTransformers,
  TransformerRegistryItem,
  TransformerUIProps,
  TransformerCategory,
} from '@grafana/data';
import { MergeTransformerOptions } from '@grafana/data/internal';
import { Trans, t } from '@grafana/i18n';
import { FieldValidationMessage, InlineField, Input } from '@grafana/ui';

import { getTransformationContent } from '../docs/getTransformationContent';
import darkImage from '../images/dark/merge.svg';
import lightImage from '../images/light/merge.svg';

export const MergeTransformerEditor = ({ input, options, onChange }: TransformerUIProps<MergeTransformerOptions>) => {
  const onChangeFrameAlias = useCallback(
    (evt: ChangeEvent<HTMLInputElement>) => {
      onChange({
        ...options,
        frameAlias: evt.target.value,
      });
    },
    [onChange, options]
  );

  if (input.length <= 1) {
    // Show warning that merge is useless only apply on a single frame
    return (
      <FieldValidationMessage>
        <Trans i18nKey="transformers.merge-transformer-editor.merge-effect-applied-single-frame">
          Merge has no effect when applied on a single frame.
        </Trans>
      </FieldValidationMessage>
    );
  }
  return (
    <InlineField
      htmlFor="frame-alias"
      labelWidth={16}
      label={t('transformers.reduce-transformer-editor.label-frame-alias', 'Frame Alias')}
    >
      <Input id="frame-alias" value={options.frameAlias} onChange={onChangeFrameAlias} />
    </InlineField>
  );
};

export const getMergeTransformerRegistryItem: () => TransformerRegistryItem<MergeTransformerOptions> = () => ({
  id: DataTransformerID.merge,
  editor: MergeTransformerEditor,
  transformation: standardTransformers.mergeTransformer,
  name: t('transformers.merge-transformer-editor.name.merge', 'Merge series/tables'),
  description: t(
    'transformers.merge-transformer-editor.description.merge-multiple-series',
    'Merge multiple series. Values will be combined into one row.'
  ),
  categories: new Set([TransformerCategory.Combine]),
  help: getTransformationContent(DataTransformerID.merge).helperDocs,
  imageDark: darkImage,
  imageLight: lightImage,
});
