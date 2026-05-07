import { useEffect, useState } from 'react';

import { type AsyncSingletonLoader } from './createAsyncSingletonLoader';

export function useAsyncReady<T>(loader: AsyncSingletonLoader<T>): boolean {
  const [ready, setReady] = useState(loader.isLoaded());

  useEffect(() => {
    if (ready) {
      return;
    }

    let cancelled = false;

    loader.load().finally(() => {
      if (!cancelled) {
        setReady(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [loader, ready]);

  return ready;
}
