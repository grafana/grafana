import { useCallback, useState } from 'react';

export const useTemporaryState = <T>(defaltDurationMs = 5000) => {
  const [state, setState] = useState<T | undefined>();

  const setterWithTimeout = useCallback(
    (value: T, durationMs?: number) => {
      setState(value);
      setTimeout(() => {
        setState(undefined);
      }, durationMs || defaltDurationMs);
    },
    [defaltDurationMs]
  );

  return [state, setterWithTimeout] as const;
};
