import { SelectableValue } from '@grafana/data';
import { Select } from '@grafana/ui';
import { ComponentProps, useState } from 'react';

const hasValue = <T extends SelectableValue>(searchValue: T['value']) => ({ value }: T) => value === searchValue;

const getInitialState = <T extends SelectableValue>(initialOptions: T[], initialValue?: T['value']): T[] => {
  if (initialValue === undefined || initialOptions.some(hasValue(initialValue))) {
    return initialOptions;
  }

  return initialOptions.concat({
    value: initialValue,
    label: initialValue,
  } as T);
};

interface Params<T extends SelectableValue> {
  options: T[];
  value?: T['value'];
  onChange: (value: T['value']) => void;
}

/**
 * Creates the Props needed by Select to handle custom values and handles custom value creation
 * and the initial value when it is not present in the option array.
 */
export const useCreatableSelectPersistedBehaviour = <T extends SelectableValue>({
  options: initialOptions,
  value,
  onChange,
}: Params<T>): Pick<
  ComponentProps<typeof Select>,
  'onChange' | 'onCreateOption' | 'options' | 'allowCustomValue' | 'value'
> => {
  const [options, setOptions] = useState<T[]>(getInitialState(initialOptions, value));

  const addOption = (newValue: T['value']) => setOptions([...options, { value: newValue, label: newValue } as T]);

  return {
    onCreateOption: (value) => {
      addOption(value);
      onChange(value);
    },
    onChange: (e) => {
      onChange(e.value);
    },
    allowCustomValue: true,
    options,
    value,
  };
};
