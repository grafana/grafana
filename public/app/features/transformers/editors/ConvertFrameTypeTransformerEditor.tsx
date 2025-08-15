import { useCallback } from 'react';

import {
  DataTransformerID,
  SelectableValue,
  standardTransformers,
  TransformerRegistryItem,
  TransformerUIProps,
  TransformerCategory,
} from '@grafana/data';
import { ConvertFrameTypeTransformerOptions, FrameType } from '@grafana/data/internal';
import { t } from '@grafana/i18n';
import { InlineField, InlineFieldRow, Select } from '@grafana/ui';

import { getTransformationContent } from '../docs/getTransformationContent';

export const ConvertFrameTypeTransformerEditor = ({
  options,
  onChange,
}: TransformerUIProps<ConvertFrameTypeTransformerOptions>) => {
  const dataTopicOptions: Array<SelectableValue<FrameType>> = [
    {
      label: t('transformers.convert-frame-type-transformer-editor.label.exemplar', 'Exemplar'),
      value: FrameType.Exemplar,
      description: t(
        'transformers.convert-frame-type-transformer-editor.label.exemplar-description',
        'Convert to Exemplar frame(s)'
      ),
    },
  ];

  const onSelectDataTopic = useCallback(
    (value: SelectableValue<FrameType>) => {
      onChange({
        ...options,
        targetType: value.value,
      });
    },
    [onChange, options]
  );

  return (
    <>
      <InlineFieldRow>
        <InlineField
          label={t('transformers.convert-frame-type-transformer-editor.label.target-data-topic', 'Target data topic')}
        >
          <Select
            options={dataTopicOptions}
            value={options.targetType}
            placeholder={t(
              'transformers.convert-frame-type-transformer-editor.placeholder.data-topic',
              'Select data topic'
            )}
            onChange={onSelectDataTopic}
            width={30}
          />
        </InlineField>
      </InlineFieldRow>
    </>
  );
};

export const getConvertFrameTypeTransformRegistryItem: () => TransformerRegistryItem<ConvertFrameTypeTransformerOptions> =
  () => ({
    id: DataTransformerID.convertFrameType,
    editor: ConvertFrameTypeTransformerEditor,
    transformation: standardTransformers.convertFrameTypeTransformer,
    name: t('transformers.convert-frame-type-transformer-editor.convert-frame-type', 'Convert frame type'),
    description: t(
      'transformers.convert-frame-type-transformer-editor.description.convert-frame-type',
      'Convert frame data topic (e.g., series to annotations/exemplars).'
    ),
    categories: new Set([TransformerCategory.Reformat]),
    help: getTransformationContent(DataTransformerID.convertFrameType).helperDocs,
    tags: new Set(['Annotation']),
    // @TODO: Update imageDark/imageLight
    imageDark: '',
    imageLight: '',
  });
