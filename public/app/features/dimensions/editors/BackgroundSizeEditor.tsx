import React, { FC, useCallback } from 'react';

import { SelectableValue, StandardEditorProps } from '@grafana/data';
import { InlineField, InlineFieldRow, RadioButtonGroup } from '@grafana/ui/src';
import { BackgroundImageSize } from 'app/features/canvas';

const options: Array<SelectableValue<BackgroundImageSize>> = [
  { value: BackgroundImageSize.Original, label: 'Original' },
  { value: BackgroundImageSize.Contain, label: 'Contain' },
  { value: BackgroundImageSize.Cover, label: 'Cover' },
  { value: BackgroundImageSize.Fill, label: 'Fill' },
  { value: BackgroundImageSize.Tile, label: 'Tile' },
];

export const BackgroundSizeEditor: FC<StandardEditorProps<string, undefined, undefined>> = (props) => {
  const { value, onChange } = props;

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
