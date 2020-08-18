import React, { useCallback, useState, useRef, useEffect } from 'react';
import { SelectableValue } from '@grafana/data';
import { minSameWidthModifier } from './utils';
import { usePopper } from 'react-popper';
import { Placement } from '@popperjs/core';
import { AsyncSelectOptionsResolver } from './types';
import debounce from 'debounce-promise';

export interface UseSelectOptions<T> {
  options: Array<SelectableValue<T>>;
  placement: Placement;
}

export interface UseAsyncSelectOptions<T> extends Omit<UseSelectOptions<T>, 'options'> {
  loadOptions: AsyncSelectOptionsResolver<T>;
}

export function useSelect<T = any>({ options, placement }: UseSelectOptions<T>) {
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

  // naive filter implementation, will probably need customization
  const filterOptions = useCallback(
    (inputValue: string | null) => {
      if (!inputValue) {
        return options;
      }
      return options.filter(o => o.label!.includes(inputValue));
    },
    [options]
  );

  return {
    triggerRef,
    setPopperRef,
    setPopperElement,
    popperProps,
    filterOptions,
  };
}

export function useAsyncSelect<T>({ loadOptions, ...useSelectOptions }: UseAsyncSelectOptions<T>) {
  const selectOptions = useSelect<T>({ ...useSelectOptions, options: [] });
  const onLoadOptions = useRef<any>(null);
  const [currentValue, setCurrentValue] = useState<string | null>();

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

  return { ...selectOptions, onLoadOptions, currentValue, setCurrentValue };
}
