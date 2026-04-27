import { useCallback } from 'react';

import type { StandardEditorProps } from '@grafana/data/field';
import type { SelectableValue } from '@grafana/data/types';
import { t } from '@grafana/i18n';
import { InlineField, InlineFieldRow, RadioButtonGroup } from '@grafana/ui';
import { BackgroundImageSize } from 'app/plugins/panel/canvas/panelcfg.gen';

export const BackgroundSizeEditor = ({ value, onChange }: StandardEditorProps<string, undefined, undefined>) => {
  const options: Array<SelectableValue<BackgroundImageSize>> = [
    {
      value: BackgroundImageSize.Original,
      label: t('dimensions.background-size-editor.options.label-original', 'Original'),
    },
    {
      value: BackgroundImageSize.Contain,
      label: t('dimensions.background-size-editor.options.label-contain', 'Contain'),
    },
    { value: BackgroundImageSize.Cover, label: t('dimensions.background-size-editor.options.label-cover', 'Cover') },
    { value: BackgroundImageSize.Fill, label: t('dimensions.background-size-editor.options.label-fill', 'Fill') },
    { value: BackgroundImageSize.Tile, label: t('dimensions.background-size-editor.options.label-tile', 'Tile') },
  ];
  const imageSize = value ?? BackgroundImageSize.Cover;

  const onImageSizeChange = useCallback(
    (size: string) => {
      onChange(size);
    },
    [onChange]
  );

  return (
    <InlineFieldRow>
      <InlineField grow={true}>
        <RadioButtonGroup value={imageSize} options={options} onChange={onImageSizeChange} fullWidth />
      </InlineField>
    </InlineFieldRow>
  );
};
