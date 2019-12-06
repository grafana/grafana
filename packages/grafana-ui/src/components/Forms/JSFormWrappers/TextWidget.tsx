import React from 'react';
import { WidgetProps } from 'react-jsonschema-form';
import { Input } from '../Input/Input';

export const TextWidget: React.FC<WidgetProps> = ({ value, id, onChange, placeholder, onBlur, schema }) => {
  return (
    <Input
      type={schema.type === 'number' || schema.type === 'integer' ? 'number' : 'text'}
      id={id}
      value={value}
      onChange={e => {
        onChange(e.currentTarget.value);
      }}
      onBlur={e => {
        // currently not working with validation
        onBlur(id, e.currentTarget.value);
      }}
      placeholder={placeholder}
    />
  );
};
