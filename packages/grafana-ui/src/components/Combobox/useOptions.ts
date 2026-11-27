/* Spreading unbound arrays can be very slow or even crash the browser if used for arguments */
/* eslint no-restricted-syntax: ["error", "SpreadElement"] */

import { debounce } from 'lodash';
import { useLayoutEffect, useState, useCallback, useEffect, useMemo, useRef } from 'react';

import { t } from '@grafana/i18n';

import { fuzzyFind, itemToString } from './filter';
import { type ComboboxOption } from './types';
import { StaleResultError, useLatestAsyncCall } from './useLatestAsyncCall';

type AsyncOptions<T extends string | number> =
  | Array<ComboboxOption<T>>
  | ((inputValue: string) => Promise<Array<ComboboxOption<T>>>);

const asyncNoop = () => Promise.resolve([]);

export const DEBOUNCE_TIME_MS = 200;

/**
 * Abstracts away sync/async options for combobox components.
 * It also filters options based on the user's input.
 *
 * Returns:
 *  - options either filtered by user's input, or from async options fn
 *  - function to call when user types (to filter, or call async fn)
 *  - loading and error states
 */
export function useOptions<T extends string | number>(
  rawOptions: AsyncOptions<T>,
  createCustomValue: boolean,
  customValueDescription?: string
) {
  const isAsync = typeof rawOptions === 'function';

  // Read `options` through a ref so the debounced loader keeps a stable identity even when
  // consumers pass a new function on every render.
  // TODO: switch to useEffectEvent once React stabilises it.
  const rawOptionsRef = useRef(rawOptions);
  useLayoutEffect(() => {
    rawOptionsRef.current = rawOptions;
  });

  const stableRawOptions = useCallback((searchTerm: string) => {
    const currentRawOptions = rawOptionsRef.current;
    return typeof currentRawOptions === 'function' ? currentRawOptions(searchTerm) : asyncNoop();
  }, []);

  const loadOptions = useLatestAsyncCall(stableRawOptions);

  const debouncedLoadOptions = useMemo(
    () =>
      debounce((searchTerm: string) => {
        return loadOptions(searchTerm)
          .then((options) => {
            setAsyncOptions(options);
            setLoadedSearch(searchTerm);
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
      }, DEBOUNCE_TIME_MS),
    [loadOptions]
  );

  // Runs only on unmount (debouncedLoadOptions is stable): cancels a pending debounce timer
  // so it can't fire after unmount. In-flight requests are handled by useLatestAsyncCall.
  useEffect(() => () => debouncedLoadOptions.cancel(), [debouncedLoadOptions]);

  const [asyncOptions, setAsyncOptions] = useState<Array<ComboboxOption<T>>>([]);
  const [asyncLoading, setAsyncLoading] = useState(false);
  const [asyncError, setAsyncError] = useState(false);
  // The search the async options were loaded for. A request can settle while a newer search is still debouncing.
  const [loadedSearch, setLoadedSearch] = useState<string | null>(null);

  // This hook keeps its own inputValue state (rather than accepting it as an arg) because it needs to be
  // told it for async options loading anyway.
  const [userTypedSearch, setUserTypedSearch] = useState('');

  // While a newer search is pending, or after one failed, the async options are an earlier search's results.
  const asyncOptionsStale = isAsync && (asyncLoading || asyncError || loadedSearch !== userTypedSearch);

  const addCustomValue = useCallback(
    (opts: Array<ComboboxOption<T>>) => {
      let currentOptions: Array<ComboboxOption<T>> = opts;
      let customValueOption: ComboboxOption<T> | undefined;
      if (createCustomValue && userTypedSearch) {
        // Since the label of a normal option does not have to match its value and a custom option has the same value and label,
        // we just focus on the value to check if the option already exists
        // A stale match doesn't count: it can't be picked, and its search may never come back.
        const customValueExists = !asyncOptionsStale && opts.some((opt) => opt.value === userTypedSearch);
        if (!customValueExists) {
          // Make sure to clone the array first to avoid mutating the original array!
          currentOptions = currentOptions.slice();
          customValueOption = {
            label: userTypedSearch,
            value: userTypedSearch as T,
            description: customValueDescription ?? t('combobox.custom-value.description', 'Use custom value'),
          };
          currentOptions.unshift(customValueOption);
        }
      }
      return { options: currentOptions, customValueOption };
    },
    [asyncOptionsStale, createCustomValue, customValueDescription, userTypedSearch]
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

  const finalOptions = useMemo(() => {
    const { options, groupStartIndices } = sortByGroup(filteredOptions);
    const { options: optionsWithCustomValue, customValueOption } = addCustomValue(options);

    return { options: optionsWithCustomValue, groupStartIndices, customValueOption };
  }, [filteredOptions, addCustomValue]);

  const resetSearch = useCallback(() => {
    setUserTypedSearch('');
  }, []);

  // Stale options stay in the menu so it doesn't flicker, but can't be picked. The custom value always matches what was
  // typed.
  const customValueOption = finalOptions.customValueOption;
  const isOptionStale = useCallback(
    (option: ComboboxOption<T> | null | undefined) => asyncOptionsStale && !!option && option !== customValueOption,
    [asyncOptionsStale, customValueOption]
  );

  return {
    options: finalOptions.options,
    groupStartIndices: finalOptions.groupStartIndices,
    customValueOption,
    updateOptions,
    asyncLoading,
    asyncError,
    asyncOptionsStale,
    isOptionStale,
    resetSearch,
  };
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
