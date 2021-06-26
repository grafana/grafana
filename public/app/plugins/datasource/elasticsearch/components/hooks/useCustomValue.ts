import { SelectableValue } from '@grafana/data';
import { Select } from '@grafana/ui';
import { ComponentProps, useState } from 'react';

const hasValue = <T extends SelectableValue>(searchValue: T['value']) => ({ value }: T) => value === searchValue;

const getInitialState = <T extends SelectableValue>(initialOptions: T[], initialValue?: T['value']): T[] => {
  return initialOptions.concat(
    initialOptions.some(hasValue(initialValue))
      ? []
      : ({
          value: initialValue,
          label: initialValue,
        } as T)
  );
};

interface UseCustomValue<T extends SelectableValue> {
  options: T[];
  value?: T['value'];
  onChange?: (value: T['value']) => void;
}
export const useCustomValue = <T extends SelectableValue>({
  options: initialOptions,
  value,
  onChange,
}: UseCustomValue<T>): Pick<
  ComponentProps<typeof Select>,
  'onChange' | 'onCreateOption' | 'options' | 'allowCustomValue' | 'value'
> => {
  const [options, setOptions] = useState<T[]>(getInitialState(initialOptions, value));

  const addOption = (newValue: T['value']) => setOptions([...options, { value: newValue, label: newValue } as T]);

  return {
    onCreateOption: (value) => {
      addOption(value);
      onChange?.(value);
    },
    onChange: (e) => {
      onChange?.(e.value);
    },
    allowCustomValue: true,
    options,
    value,
  };
};
