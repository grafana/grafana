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
 * Abstracts away sync/async options for MultiCombobox (and later Combobox).
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
        //Since the label of a normal option does not have to match its value and a custom option has the same value and label,
        //we just focus on the value to check if the option already exists
        const customValueExists = opts.some((opt) => opt.value === userTypedSearch);
        if (!customValueExists) {
          currentOptions = [
            {
              label: userTypedSearch,
              value: userTypedSearch as T,
              description: t('combobox.custom-value.description', 'Use custom value'),
            },
            ...currentOptions,
          ];
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

  const organizeOptionsByGroup = useCallback((options: Array<ComboboxOption<T>>) => {
    const groupedOptions = new Map<string | undefined, Array<ComboboxOption<T>>>();
    for (const option of options) {
      const groupExists = groupedOptions.has(option.group);
      if (groupExists) {
        groupedOptions.get(option.group)?.push(option);
      } else {
        groupedOptions.set(option.group, [option]);
      }
    }

    // Reorganize options to have groups first, then undefined group
    const reorganizeOptions = [];
    for (const [group, groupOptions] of groupedOptions) {
      if (!group) {
        continue;
      }
      reorganizeOptions.push(...groupOptions);
    }

    const undefinedGroupOptions = groupedOptions.get(undefined);
    if (undefinedGroupOptions) {
      reorganizeOptions.push(...undefinedGroupOptions);
    }
    return reorganizeOptions;
  }, []);

  const stringifiedOptions = useMemo(() => {
    return isAsync ? [] : rawOptions.map(itemToString);
  }, [isAsync, rawOptions]);

  const finalOptions = useMemo(() => {
    const currentOptions = isAsync ? asyncOptions : fuzzyFind(rawOptions, stringifiedOptions, userTypedSearch);
    const currentOptionsOrganised = organizeOptionsByGroup(currentOptions);

    return addCustomValue(currentOptionsOrganised);
  }, [isAsync, organizeOptionsByGroup, addCustomValue, asyncOptions, rawOptions, userTypedSearch, stringifiedOptions]);

  return { options: finalOptions, updateOptions, asyncLoading, asyncError };
}
