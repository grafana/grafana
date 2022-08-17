import React, { ChangeEvent } from 'react';
import { Input as InputField, InlineField } from '@grafana/ui';
import { QueryBuilderFieldProps } from './types';
import { onBuilderChange } from '.';

interface Props extends QueryBuilderFieldProps {
  type: string;
}

export const Input = (props: Props) => {
  const onChange = (event: ChangeEvent<HTMLInputElement>) => {
    let value: string | number = event.target.value;
    if (
      props.type === 'number' &&
      !(value.indexOf('$') === 0 || value.indexOf('[') === 0 || value.indexOf('.') === value.length - 1)
    ) {
      //must be a number, but is not a variable, nor an incomplete float, so, convert to Number or fallback to previous valid value
      value = Number(value);
      if (isNaN(value)) {
        value = props.options.builder || '';
      }
    }
    onBuilderChange(props, value);
  };
  return (
    <InlineField label={props.label} grow>
      <InputField name={props.name} placeholder={props.description} value={props.options.builder} onChange={onChange} />
    </InlineField>
  );
};
