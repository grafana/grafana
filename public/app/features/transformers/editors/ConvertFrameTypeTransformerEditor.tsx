import { css } from '@emotion/css';
import { useCallback } from 'react';

import {
  DataTransformerID,
  FieldNamePickerConfigSettings,
  GrafanaTheme2,
  SelectableValue,
  StandardEditorsRegistryItem,
  standardTransformers,
  TransformerCategory,
  TransformerRegistryItem,
  TransformerUIProps,
} from '@grafana/data';
import { ConvertFrameTypeTransformerOptions, FrameType, AnnotationFieldMapping } from '@grafana/data/internal';
import { t } from '@grafana/i18n';
import { InlineField, InlineFieldRow, Select, useStyles2 } from '@grafana/ui';
import { FieldNamePicker } from '@grafana/ui/internal';

import { getTransformationContent } from '../docs/getTransformationContent';

// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
const fieldNamePickerSettings = {
  settings: { width: 24, isClearable: false },
} as StandardEditorsRegistryItem<string, FieldNamePickerConfigSettings>;

export const ConvertFrameTypeTransformerEditor = ({
  options,
  onChange,
  input,
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
    {
      label: t('transformers.convert-frame-type-transformer-editor.label.annotation', 'Annotation'),
      value: FrameType.Annotation,
      description: t(
        'transformers.convert-frame-type-transformer-editor.label.annotation-description',
        'Convert to Annotation frame(s)'
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

  const onSelectAnnotationMapping = useCallback(
    (label: keyof AnnotationFieldMapping, value: string) => {
      onChange({
        ...options,
        annotationFieldMapping: {
          ...options.annotationFieldMapping,
          [label]: value,
        },
      });
    },
    [onChange, options]
  );

  const styles = useStyles2(getStyles);

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
      {options.targetType === FrameType.Annotation && (
        <section className={styles.annotationOptions}>
          <InlineFieldRow>
            <InlineField
              labelWidth={20}
              label={t('transformers.annotation-transformer-editor.start-time', 'Start time')}
            >
              <FieldNamePicker
                context={{ data: input }}
                value={options.annotationFieldMapping?.time ?? ''}
                onChange={(value) => {
                  if (value) {
                    onSelectAnnotationMapping('time', value);
                  }
                }}
                item={fieldNamePickerSettings}
              />
            </InlineField>
          </InlineFieldRow>
          <InlineFieldRow>
            <InlineField labelWidth={20} label={t('transformers.annotation-transformer-editor.timeEnd', 'End time')}>
              <FieldNamePicker
                context={{ data: input }}
                value={options.annotationFieldMapping?.timeEnd ?? ''}
                onChange={(value) => {
                  if (value) {
                    onSelectAnnotationMapping('timeEnd', value);
                  }
                }}
                item={fieldNamePickerSettings}
              />
            </InlineField>
          </InlineFieldRow>
          <InlineFieldRow>
            <InlineField labelWidth={20} label={t('transformers.annotation-transformer-editor.title', 'Title')}>
              <FieldNamePicker
                context={{ data: input }}
                value={options.annotationFieldMapping?.title ?? ''}
                onChange={(value) => {
                  if (value) {
                    onSelectAnnotationMapping('title', value);
                  }
                }}
                item={fieldNamePickerSettings}
              />
            </InlineField>
          </InlineFieldRow>
          <InlineFieldRow>
            <InlineField labelWidth={20} label={t('transformers.annotation-transformer-editor.text', 'Text')}>
              <FieldNamePicker
                context={{ data: input }}
                value={options.annotationFieldMapping?.text ?? ''}
                onChange={(value) => {
                  if (value) {
                    onSelectAnnotationMapping('text', value);
                  }
                }}
                item={fieldNamePickerSettings}
              />
            </InlineField>
          </InlineFieldRow>
          <InlineFieldRow>
            <InlineField labelWidth={20} label={t('transformers.annotation-transformer-editor.tags', 'Tags')}>
              <FieldNamePicker
                context={{ data: input }}
                value={options.annotationFieldMapping?.tags ?? ''}
                onChange={(value) => {
                  if (value) {
                    onSelectAnnotationMapping('tags', value);
                  }
                }}
                item={fieldNamePickerSettings}
              />
            </InlineField>
          </InlineFieldRow>
          <InlineFieldRow>
            <InlineField labelWidth={20} label={t('transformers.annotation-transformer-editor.id', 'Annotation ID')}>
              <FieldNamePicker
                context={{ data: input }}
                value={options.annotationFieldMapping?.id ?? ''}
                onChange={(value) => {
                  if (value) {
                    onSelectAnnotationMapping('id', value);
                  }
                }}
                item={fieldNamePickerSettings}
              />
            </InlineField>
          </InlineFieldRow>
        </section>
      )}
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

const getStyles = (theme: GrafanaTheme2) => {
  return {
    annotationOptions: css({
      marginTop: theme.spacing(2),
    }),
  };
};
