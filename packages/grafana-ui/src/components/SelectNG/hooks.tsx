import React, { useCallback, useState, useRef, useEffect } from 'react';
import { SelectableValue } from '@grafana/data';
import { flattenOptions, minSameWidthModifier, shouldAllowOptionCreate } from './utils';
import { usePopper } from 'react-popper';
import { Placement } from '@popperjs/core';
import { AsyncSelectOptionsResolver } from './types';
import debounce from 'debounce-promise';

export interface UseSelectOptions<T> {
  placement: Placement;
}

export interface UseAsyncSelectOptions<T> extends Omit<UseSelectOptions<T>, 'options'> {
  loadOptions: AsyncSelectOptionsResolver<T>;
}

// Util hook for proiv
export function useSelect<T = any>({ placement }: UseSelectOptions<T>) {
  const triggerRef = React.createRef<HTMLInputElement>();
  const [popperRef, setPopperRef] = useState<HTMLDivElement | null>(null);
  const [popperElement, setPopperElement] = useState<HTMLDivElement | null>(null);

  const popper = usePopper(popperRef, popperElement, {
    modifiers: [
      minSameWidthModifier as any,
      {
        name: 'arrow',
        options: {
          enabled: false,
        },
      },
      {
        name: 'flip',
        options: {
          enabled: false,
        },
      },
    ],
    placement,
  });

  const popperProps = {
    style: popper.styles.popper,
    ...popper.attributes.popper,
  };

  const defaultFilter = (o: SelectableValue, inputValue: string) => {
    return o.label!.includes(inputValue);
  };
  // naive filter implementation, will probably need customization
  const filterOptions = (filterable: SelectableValue[], inputValue?: string | null) => {
    if (!inputValue || inputValue.trim() === '') {
      return filterable;
    }

    return filterable.reduce((acc, item) => {
      const resultOption = { ...item };

      if (item.options) {
        resultOption.options = filterOptions(item.options, inputValue);
        if (resultOption.options.length > 0) {
          acc.push(resultOption);
        }
      } else {
        if (defaultFilter(resultOption, inputValue)) {
          acc.push(resultOption);
        }
      }

      return acc;
    }, [] as SelectableValue[]);
  };

  return {
    triggerRef,
    setPopperRef,
    setPopperElement,
    popperProps,
    filterOptions,
  };
}

export function useAsyncSelect<T>({ loadOptions, ...useSelectOptions }: UseAsyncSelectOptions<T>) {
  const [options, setOptions] = useState<Array<SelectableValue<T>> | null>();
  const onLoadOptions = useRef<any>(null);
  const [currentValue, setCurrentValue] = useState<string | null>();
  const selectOptions = useSelect<T>(useSelectOptions);

  useEffect(() => {
    // I want the debounce to be built into AsyncSelect, yay or nay?
    onLoadOptions.current = debounce(
      async (inputValue: string | null) => {
        return await loadOptions(inputValue);
      },
      300, // TODO: config via prop?
      { leading: false }
    );
  }, [loadOptions]);

  return { ...selectOptions, options, onLoadOptions, currentValue, setCurrentValue, setOptions };
}

export const useSelectKeyboardEvents = (
  onChange: (value: SelectableValue | null) => void,
  onOptionCreate?: (v: SelectableValue) => void,
  allowCustomValue?: boolean,
  removeValueWithBackspace?: boolean
) => {
  return useCallback(
    (
      options: SelectableValue[],
      selectedOption: SelectableValue | null,
      highlightedIndex: number | null,
      onKeyDown: (e: React.KeyboardEvent) => void
    ) => (e: React.KeyboardEvent<HTMLInputElement>) => {
      const currentValue = e.currentTarget.value;
      switch (e.key) {
        case 'Enter':
          const flatOptions = flattenOptions(options);

          if (currentValue.trim() !== '' && highlightedIndex === flatOptions.length + 1) {
            if (
              allowCustomValue &&
              onOptionCreate &&
              e.key === 'Enter' &&
              shouldAllowOptionCreate(options, currentValue)
            ) {
              const newItem = { value: currentValue as any, label: currentValue };
              onOptionCreate(newItem);
              onChange(newItem);
            }
          } else {
            onKeyDown(e);
          }
          return;

        case 'Backspace':
          if (currentValue.trim() === '') {
            e.preventDefault();
          } else {
            if (removeValueWithBackspace && selectedOption) {
              onChange(null);
            } else {
              // When removing with backspace is not enabled run the original Downshift keydown handler
              onKeyDown(e);
            }
          }
          return;
        default:
          // Run Downshift provided keydown handler by default
          onKeyDown(e);
      }
    },
    [allowCustomValue, onOptionCreate, removeValueWithBackspace]
  );
};
