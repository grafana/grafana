import { useEffect, useState } from 'react';

import { type AsyncSingletonLoader } from './createAsyncSingletonLoader';

// Overload 1: void-args loaders can be used without passing anything.
export function useAsyncReady<T>(loader: AsyncSingletonLoader<T, void>): boolean;
// Overload 2: loaders with non-void Args must receive them.
export function useAsyncReady<T, Args>(loader: AsyncSingletonLoader<T, Args>, args: Args): boolean;
export function useAsyncReady<T, Args>(loader: AsyncSingletonLoader<T, Args>, args?: Args): boolean {
  const [ready, setReady] = useState(loader.isLoaded());

  useEffect(() => {
    if (ready) {
      return;
    }

    let cancelled = false;

    // The loader's singleton semantics mean only the first call's args have
    // any effect; later renders pass args through but get the cached promise.
    loader.load(args).finally(() => {
      if (!cancelled) {
        setReady(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [loader, ready, args]);

  return ready;
}
