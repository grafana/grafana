import { debounce } from 'lodash';
import { useState, useCallback, useMemo } from 'react';

import { itemFilter } from './filter';
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
export function useOptions<T extends string | number>(rawOptions: AsyncOptions<T>) {
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

  const updateOptions = useCallback(
    (inputValue: string) => {
      if (!isAsync) {
        setUserTypedSearch(inputValue);
        return;
      }

      setAsyncLoading(true);

      debouncedLoadOptions(inputValue);
    },
    [debouncedLoadOptions, isAsync]
  );

  const finalOptions = useMemo(() => {
    if (isAsync) {
      return asyncOptions;
    } else {
      return rawOptions.filter(itemFilter(userTypedSearch));
    }
  }, [rawOptions, asyncOptions, isAsync, userTypedSearch]);

  return { options: finalOptions, updateOptions, asyncLoading, asyncError };
}
