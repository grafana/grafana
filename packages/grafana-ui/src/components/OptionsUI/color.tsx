import React from 'react';
import { FieldConfigEditorProps, ColorFieldConfigSettings } from '@grafana/data';
import { ColorPicker } from '../ColorPicker/ColorPicker';

export const ColorValueEditor: React.FC<FieldConfigEditorProps<string, ColorFieldConfigSettings>> = ({
  value,
  onChange,
  item,
}) => {
  return <ColorPicker color={value} onChange={onChange} enableNamedColors={!!item.settings.enableNamedColors} />;
};
