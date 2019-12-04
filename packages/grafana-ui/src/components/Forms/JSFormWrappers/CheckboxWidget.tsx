import React from 'react';
import { WidgetProps } from 'react-jsonschema-form';
import { Checkbox } from '../Checkbox';

export const CheckboxWidget: React.FC<WidgetProps> = ({ label, value, id, onChange }) => {
  return (
    <Checkbox
      id={id}
      value={!!value}
      label={label}
      onChange={v => {
        onChange(v);
      }}
    />
  );
};
