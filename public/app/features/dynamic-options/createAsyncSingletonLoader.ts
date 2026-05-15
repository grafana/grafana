export interface AsyncSingletonLoader<T, Args = void> {
  load: (args: Args) => Promise<T>;
  isLoaded: () => boolean;
  reset: () => void;
}

// Singleton semantics: the first `load(args)` call wins. Subsequent calls
// return the same cached promise regardless of the args passed, until
// `reset()` is called. Concrete loaders that depend on a runtime value
// (e.g. theme) should accept it as Args so the dependency is visible at the
// call site, but should not expect later args to re-fetch.
export function createAsyncSingletonLoader<T, Args = void>(
  fetcher: (args: Args) => Promise<T>,
  onResolve?: (value: T) => void
): AsyncSingletonLoader<T, Args> {
  let cachedPromise: Promise<T> | undefined;
  let loaded = false;

  const load = (args: Args) => {
    if (!cachedPromise) {
      cachedPromise = fetcher(args).then((value) => {
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
