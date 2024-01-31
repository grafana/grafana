import { useCallback, useState } from 'react';

export const useTimeoutState = <T>(initialState: T | undefined, defaultMs: number) => {
  const [state, setState] = useState<T | undefined>(initialState);

  const setterWithTimeout = useCallback(
    (value: T, ms?: number) => {
      setState(value);
      setTimeout(() => {
        setState(undefined);
      }, ms || defaultMs);
    },
    [defaultMs]
  );

  return [state, setterWithTimeout];
};
