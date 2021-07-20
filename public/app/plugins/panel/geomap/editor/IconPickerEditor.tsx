import React, { FC, useCallback } from 'react';
import { StandardEditorProps, SelectableValue } from '@grafana/data';
import { Select } from '@grafana/ui';
import { shapes } from '../utils/regularShapes';
import tinycolor from 'tinycolor2';

export const IconPickerEditor: FC<StandardEditorProps<string | undefined, any, any>> = ({
  value,
  onChange,
  context,
}) => {
  const color = context.options?.config?.color?.fixed;
  const radius = context.options?.config?.size?.fixed;
  const opacity = context.options?.config?.fillOpacity;
  const fillColor = tinycolor(color).setAlpha(opacity).toRgbString();
  const shapesArr = shapes(color, fillColor, radius);
  const onSelectChange = useCallback(
    (option: SelectableValue) => {
      onChange(option.label);
    },
    [onChange]
  );
  return (
    <>
      <Select value={value} options={shapesArr} onChange={onSelectChange} />
    </>
  );
};
