import { useCallback } from 'react';

import { SelectableValue, StandardEditorProps } from '@grafana/data';
import { InlineField, InlineFieldRow, RadioButtonGroup } from '@grafana/ui';
import { BackgroundImageSize } from 'app/plugins/panel/canvas/panelcfg.gen';

const options: Array<SelectableValue<BackgroundImageSize>> = [
  { value: BackgroundImageSize.Original, label: 'Original' },
  { value: BackgroundImageSize.Contain, label: 'Contain' },
  { value: BackgroundImageSize.Cover, label: 'Cover' },
  { value: BackgroundImageSize.Fill, label: 'Fill' },
  { value: BackgroundImageSize.Tile, label: 'Tile' },
];

export const BackgroundSizeEditor = ({ value, onChange }: StandardEditorProps<string, undefined, undefined>) => {
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
