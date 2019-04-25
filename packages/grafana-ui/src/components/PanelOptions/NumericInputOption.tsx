import React from 'react';

import { Input } from '../Input/Input';
import { FormField } from '../FormField/FormField';
import { OptionInputAPI } from '../../types/panelOptions';

interface NumericOptionProps extends OptionInputAPI<number> {
  label: string;
  float?: boolean;
}

const NumericOption: React.FunctionComponent<NumericOptionProps> = ({ float, label, value, onChange, properties }) => {
  return (
    <FormField
      required={!!properties && properties.required}
      label={properties ? `${properties.label} ${properties.required ? '*' : ''}` : ''}
      inputEl={
        <Input
          type="number"
          value={value}
          onChange={event => {
            if (float) {
              onChange(parseFloat(event.currentTarget.value));
            } else {
              onChange(parseInt((event.currentTarget as HTMLInputElement).value, 10), event);
            }
          }}
        />
      }
    />
  );
};

export const FloatOption: React.FunctionComponent<NumericOptionProps> = props => <NumericOption {...props} float />;
export const IntegerOption: React.FunctionComponent<NumericOptionProps> = props => (
  <NumericOption {...props} float={false} />
);
