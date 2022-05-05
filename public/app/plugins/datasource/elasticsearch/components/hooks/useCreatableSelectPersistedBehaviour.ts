import { useState } from 'react';

import { SelectableValue } from '@grafana/data';

const hasValue =
  <T extends SelectableValue>(searchValue: T['value']) =>
  ({ value }: T) =>
    value === searchValue;

const getInitialState = (initialOptions: SelectableValue[], initialValue?: string): SelectableValue[] => {
  if (initialValue === undefined || initialOptions.some(hasValue(initialValue))) {
    return initialOptions;
  }

  return [
    ...initialOptions,
    {
      value: initialValue,
      label: initialValue,
    },
  ];
};

interface Params {
  options: SelectableValue[];
  value?: string;
  onChange: (s: SelectableValue<string>) => void;
}

/**
 * Creates the Props needed by Select to handle custom values and handles custom value creation
 * and the initial value when it is not present in the option array.
 */
export const useCreatableSelectPersistedBehaviour = ({ options: initialOptions, value, onChange }: Params) => {
  const [options, setOptions] = useState(getInitialState(initialOptions, value));

  const addOption = (newValue: string) => setOptions([...options, { value: newValue, label: newValue }]);

  return {
    onCreateOption: (value: string) => {
      addOption(value);
      onChange({ value });
    },
    onChange,
    allowCustomValue: true,
    options,
    value,
  };
};
