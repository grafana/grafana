import { memo, ChangeEvent } from 'react';

import {
  DataTransformerID,
  SelectableValue,
  standardTransformers,
  TransformerRegistryItem,
  TransformerUIProps,
  TransformerCategory,
} from '@grafana/data';
import { ConcatenateFrameNameMode, ConcatenateTransformerOptions } from '@grafana/data/internal';
import { t } from '@grafana/i18n';
import { InlineField, Input, Select } from '@grafana/ui';

import { getTransformationContent } from '../docs/getTransformationContent';
import darkImage from '../images/dark/concatenate.svg';
import lightImage from '../images/light/concatenate.svg';

interface ConcatenateTransformerEditorProps extends TransformerUIProps<ConcatenateTransformerOptions> {}

export const ConcatenateTransformerEditor = memo(({ options, onChange }: ConcatenateTransformerEditorProps) => {
  const onModeChanged = (value: SelectableValue<ConcatenateFrameNameMode>) => {
    const frameNameMode = value.value ?? ConcatenateFrameNameMode.FieldName;
    onChange({
      ...options,
      frameNameMode,
    });
  };

  const onLabelChanged = (evt: ChangeEvent<HTMLInputElement>) => {
    onChange({
      ...options,
      frameNameLabel: evt.target.value,
    });
  };

  const nameModes: Array<SelectableValue<ConcatenateFrameNameMode>> = [
    {
      value: ConcatenateFrameNameMode.FieldName,
      label: t(
        'transformers.concatenate-transformer-editor.name-modes.label.copy-frame-name-to-field',
        'Copy frame name to field name'
      ),
    },
    {
      value: ConcatenateFrameNameMode.Label,
      label: t(
        'transformers.concatenate-transformer-editor.name-modes.label.label-frame',
        'Add a label with the frame name'
      ),
    },
    {
      value: ConcatenateFrameNameMode.Drop,
      label: t(
        'transformers.concatenate-transformer-editor.name-modes.label.ignore-the-frame-name',
        'Ignore the frame name'
      ),
    },
  ];

  const frameNameMode = options.frameNameMode ?? ConcatenateFrameNameMode.FieldName;

  return (
    <div>
      <InlineField label={t('transformers.concatenate-transformer-editor.label-name', 'Name')} labelWidth={16} grow>
        <Select
          width={36}
          options={nameModes}
          value={nameModes.find((v) => v.value === frameNameMode)}
          onChange={onModeChanged}
        />
      </InlineField>
      {frameNameMode === ConcatenateFrameNameMode.Label && (
        <InlineField label={t('transformers.concatenate-transformer-editor.label-label', 'Label')} labelWidth={16} grow>
          <Input
            width={36}
            value={options.frameNameLabel ?? ''}
            placeholder={t('transformers.concatenate-transformer-editor.placeholder-frame', 'Frame')}
            onChange={onLabelChanged}
          />
        </InlineField>
      )}
    </div>
  );
});
ConcatenateTransformerEditor.displayName = 'ConcatenateTransformerEditor';

export const getConcatenateTransformRegistryItem: () => TransformerRegistryItem<ConcatenateTransformerOptions> =
  () => ({
    id: DataTransformerID.concatenate,
    editor: ConcatenateTransformerEditor,
    transformation: standardTransformers.concatenateTransformer,
    name: t('transformers.editors.concatenate-transformer-editor.name.concatenate-fields', 'Concatenate fields'),
    description: t(
      'transformers.editors.concatenate-transformer-editor.description.combine-all-fields',
      'Combine all fields into a single frame.'
    ),
    categories: new Set([TransformerCategory.Combine]),
    help: getTransformationContent(DataTransformerID.concatenate).helperDocs,
    tags: new Set([t('transformers.editors.concatenate-transformer-editor.tags.combine', 'Combine')]),
    imageDark: darkImage,
    imageLight: lightImage,
  });
