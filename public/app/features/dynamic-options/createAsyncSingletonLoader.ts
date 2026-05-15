export interface AsyncSingletonLoader<T> {
  load: () => Promise<T>;
  isLoaded: () => boolean;
  reset: () => void;
}

export function createAsyncSingletonLoader<T>(
  fetcher: () => Promise<T>,
  onResolve?: (value: T) => void
): AsyncSingletonLoader<T> {
  let cachedPromise: Promise<T> | undefined;
  let loaded = false;

  const load = () => {
    if (!cachedPromise) {
      cachedPromise = fetcher().then((value) => {
        onResolve?.(value);
        loaded = true;
        return value;
      });
    }

    return cachedPromise;
  };

  const isLoaded = () => loaded;

  const reset = () => {
    cachedPromise = undefined;
    loaded = false;
  };

  return { load, isLoaded, reset };
}
