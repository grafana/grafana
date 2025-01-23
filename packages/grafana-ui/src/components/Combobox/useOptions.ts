import { useState, useCallback, useMemo } from 'react';

import { itemFilter } from './filter';
import { ComboboxOption } from './types';

type AsyncOptions<T extends string | number> =
  | Array<ComboboxOption<T>>
  | ((inputValue: string) => Promise<Array<ComboboxOption<T>>>);

/**
 * Abstracts away sync/async options for MultiCombobox (and later Combobox).
 * It also filters options based on the user's input.
 *
 * Returns:
 *  - options either filtered by user's input, or from async options fn
 *  - function to call when user types (to filter, or call async fn)
 *  - loading and error states
 */
export function useOptions<T extends string | number>(options: AsyncOptions<T>) {
  const isAsync = typeof options === 'function';
  const [asyncOptions, setAsyncOptions] = useState<Array<ComboboxOption<T>>>([]);
  const [asyncLoading, setAsyncLoading] = useState(false);
  const [asyncError, setAsyncError] = useState(false);

  // This hook keeps its own inputValue state (rather than accepting it as an arg) because it needs to be
  // told it for async options loading anyway.
  const [userTypedSearch, setUserTypedSearch] = useState('');

  const loadOptionsWhenUserTypes = useCallback(
    (inputValue: string) => {
      console.log('loadOptionsWhenUserTypes', inputValue);
      if (!isAsync) {
        setUserTypedSearch(inputValue);
        return;
      }

      setAsyncLoading(true);

      options(inputValue)
        .then((options) => {
          setAsyncOptions(options);
          setAsyncLoading(false);
          setAsyncError(false);
        })
        .catch((error) => {
          setAsyncError(true);
          setAsyncLoading(false);

          if (error) {
            console.error('Error loading async options for Combobox', error);
          }
        });
    },
    [options, isAsync]
  );

  const finalOptions = useMemo(() => {
    if (isAsync) {
      return asyncOptions;
    } else {
      return options.filter(itemFilter(userTypedSearch));
    }
  }, [options, asyncOptions, isAsync, userTypedSearch]);

  return { options: finalOptions, loadOptionsWhenUserTypes, asyncLoading, asyncError };
}
