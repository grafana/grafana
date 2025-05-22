/* Spreading unbound arrays can be very slow or even crash the browser if used for arguments */
/* eslint no-restricted-syntax: ["error", "SpreadElement"] */

import { debounce } from 'lodash';
import { useState, useCallback, useMemo } from 'react';

import { t } from '../../utils/i18n';

import { fuzzyFind, itemToString } from './filter';
import { ComboboxOption } from './types';
import { StaleResultError, useLatestAsyncCall } from './useLatestAsyncCall';

type AsyncOptions<T extends string | number> =
  | Array<ComboboxOption<T>>
  | ((inputValue: string) => Promise<Array<ComboboxOption<T>>>);

const asyncNoop = () => Promise.resolve([]);

/**
 * Abstracts away sync/async options for combobox components.
 * It also filters options based on the user's input.
 *
 * Returns:
 *  - options either filtered by user's input, or from async options fn
 *  - function to call when user types (to filter, or call async fn)
 *  - loading and error states
 */
export function useOptions<T extends string | number>(rawOptions: AsyncOptions<T>, createCustomValue: boolean) {
  const isAsync = typeof rawOptions === 'function';

  const loadOptions = useLatestAsyncCall(isAsync ? rawOptions : asyncNoop);

  const debouncedLoadOptions = useMemo(
    () =>
      debounce((searchTerm: string) => {
        return loadOptions(searchTerm)
          .then((options) => {
            setAsyncOptions(options);
            setAsyncLoading(false);
            setAsyncError(false);
          })
          .catch((error) => {
            if (!(error instanceof StaleResultError)) {
              setAsyncError(true);
              setAsyncLoading(false);

              if (error) {
                console.error('Error loading async options for Combobox', error);
              }
            }
          });
      }, 200),
    [loadOptions]
  );

  const [asyncOptions, setAsyncOptions] = useState<Array<ComboboxOption<T>>>([]);
  const [asyncLoading, setAsyncLoading] = useState(false);
  const [asyncError, setAsyncError] = useState(false);

  // This hook keeps its own inputValue state (rather than accepting it as an arg) because it needs to be
  // told it for async options loading anyway.
  const [userTypedSearch, setUserTypedSearch] = useState('');

  const addCustomValue = useCallback(
    (opts: Array<ComboboxOption<T>>) => {
      let currentOptions: Array<ComboboxOption<T>> = opts;
      if (createCustomValue && userTypedSearch) {
        // Since the label of a normal option does not have to match its value and a custom option has the same value and label,
        // we just focus on the value to check if the option already exists
        const customValueExists = opts.some((opt) => opt.value === userTypedSearch);
        if (!customValueExists) {
          // Make sure to clone the array first to avoid mutating the original array!
          currentOptions = currentOptions.slice();
          currentOptions.unshift({
            label: userTypedSearch,
            value: userTypedSearch as T,
            description: t('combobox.custom-value.description', 'Use custom value'),
          });
        }
      }
      return currentOptions;
    },
    [createCustomValue, userTypedSearch]
  );

  const updateOptions = useCallback(
    (inputValue: string) => {
      setUserTypedSearch(inputValue);
      if (isAsync) {
        setAsyncLoading(true);
        debouncedLoadOptions(inputValue);
      }
    },
    [debouncedLoadOptions, isAsync]
  );

  const stringifiedOptions = useMemo(() => {
    return isAsync ? [] : rawOptions.map(itemToString);
  }, [isAsync, rawOptions]);

  // Create a list of options filtered by the current search.
  // If async, just returns the async options.
  const filteredOptions = useMemo(() => {
    if (isAsync) {
      return asyncOptions;
    }

    return fuzzyFind(rawOptions, stringifiedOptions, userTypedSearch);
  }, [asyncOptions, isAsync, rawOptions, stringifiedOptions, userTypedSearch]);

  const [finalOptions, groupStartIndices] = useMemo(() => {
    const { options, groupStartIndices } = sortByGroup(filteredOptions);

    return [addCustomValue(options), groupStartIndices];
  }, [filteredOptions, addCustomValue]);

  return { options: finalOptions, groupStartIndices, updateOptions, asyncLoading, asyncError };
}

/**
 * Sorts options by group and returns the sorted options and the starting index of each group
 */
export function sortByGroup<T extends string | number>(options: Array<ComboboxOption<T>>) {
  // Group options by their group
  const groupedOptions = new Map<string | undefined, Array<ComboboxOption<T>>>();
  const groupStartIndices = new Map<string | undefined, number>();

  for (const option of options) {
    const group = option.group;
    const existing = groupedOptions.get(group);
    if (existing) {
      existing.push(option);
    } else {
      groupedOptions.set(group, [option]);
    }
  }

  // If we only have one group (either the undefined group, or a single group), return the original array
  if (groupedOptions.size <= 1) {
    if (options[0]?.group) {
      groupStartIndices.set(options[0]?.group, 0);
    }

    return {
      options,
      groupStartIndices,
    };
  }

  // 'Preallocate' result array with same size as input - very minor optimization
  const result: Array<ComboboxOption<T>> = new Array(options.length);

  let currentIndex = 0;

  // Fill result array with grouped and undefined grouped options
  for (const [group, groupOptions] of groupedOptions) {
    if (group) {
      groupStartIndices.set(group, currentIndex);
    }
    for (const option of groupOptions) {
      result[currentIndex++] = option;
    }
  }

  return {
    options: result,
    groupStartIndices,
  };
}
