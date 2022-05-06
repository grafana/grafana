import React from 'react';

import { SelectableValue } from '@grafana/data';

import { RadioButtonDot } from './RadioButtonDot';

export interface RadioButtonListProps<T> {
  name: string;
  value?: T;
  id?: string;
  idSelector: (option: T) => string;
  disabled?: boolean;
  disabledOptions?: T[];
  options: Array<SelectableValue<T>>;
  onChange?: (value: T) => void;
}

export function RadioButtonList<T>({ name, options, idSelector, onChange }: RadioButtonListProps<T>) {
  return (
    <>
      {options.map((option) => (
        <RadioButtonDot
          key={idSelector(option.value!)}
          id={idSelector(option.value!)} // TODO Fix null assertion
          name={name}
          label={option.label}
          onClick={() => onChange && option.value && onChange(option.value)}
        />
      ))}
    </>
  );
}
