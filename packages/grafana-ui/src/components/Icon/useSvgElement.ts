import { isValidElement, useEffect, useState, type ReactElement, type SVGProps } from 'react';
import convert from 'react-from-dom';
import { cacheStore } from 'react-inlinesvg';
import { useCacheStore } from 'react-inlinesvg/provider';

export type SvgElement = ReactElement<SVGProps<SVGElement>>;

type CacheStore = typeof cacheStore;

/**
 * Converted icons are immutable React elements, so a single conversion can back every mount of
 * that icon. Without this, each mount re-parses the same markup with DOMParser, which is the
 * dominant cost on icon-heavy surfaces that mount and unmount constantly (virtualized tables,
 * log lines).
 */
const elementCache = new Map<string, SvgElement | null>();
const loggedFailures = new Set<string>();

/** Only for tests - the cache is process-wide, so it has to be reset between them. */
export function clearSvgElementCache() {
  elementCache.clear();
  loggedFailures.clear();
}

function logFailure(src: string, error?: unknown) {
  if (loggedFailures.has(src)) {
    return;
  }

  loggedFailures.add(src);
  console.warn(`Failed to render SVG: ${src}`, error);
}

function convertContent(src: string, content: string): SvgElement | null {
  const cached = elementCache.get(src);
  if (cached !== undefined) {
    return cached;
  }

  let element: SvgElement | null = null;

  try {
    const converted = convert(content);

    if (isValidElement<SVGProps<SVGElement>>(converted)) {
      element = converted;
    } else {
      logFailure(src);
    }
  } catch (error) {
    logFailure(src, error);
  }

  elementCache.set(src, element);

  return element;
}

/** `undefined` means the icon isn't available yet, `null` that it can't be rendered at all. */
function readFromCache(store: CacheStore, src: string): SvgElement | null | undefined {
  const converted = elementCache.get(src);
  if (converted !== undefined) {
    return converted;
  }

  if (typeof DOMParser === 'undefined' || !store.isCached(src)) {
    return undefined;
  }

  return convertContent(src, store.getContent(src));
}

interface SvgElementState {
  element: SvgElement | null | undefined;
  src: string;
}

/**
 * Loads an SVG and returns it as a React element, converting each distinct `src` only once.
 *
 * Fetching and text caching are delegated to react-inlinesvg's cache store, so this shares both
 * the in-memory cache and the persistent (browser Cache API) one set up by `CacheProvider`.
 */
export function useSvgElement(src: string): { element: SvgElement | null; isLoading: boolean } {
  const contextStore = useCacheStore();
  const store = contextStore ?? cacheStore;

  const [state, setState] = useState<SvgElementState>(() => ({ element: readFromCache(store, src), src }));

  // Adjust state during render when the icon changes, so we never paint the previous icon.
  let current = state;
  if (state.src !== src) {
    current = { element: readFromCache(store, src), src };
    setState(current);
  }

  const isLoading = current.element === undefined;

  useEffect(() => {
    if (!isLoading || typeof DOMParser === 'undefined') {
      return;
    }

    let active = true;

    store
      .get(src)
      .then((content) => {
        if (!active) {
          return;
        }

        if (!content) {
          logFailure(src);
        }

        setState({ element: content ? convertContent(src, content) : null, src });
      })
      .catch((error) => {
        if (!active) {
          return;
        }

        // Not cached as a permanent failure - the store handles its own retries, and a later
        // mount should be able to recover from a transient network error.
        logFailure(src, error);
        setState({ element: null, src });
      });

    return () => {
      active = false;
    };
  }, [isLoading, src, store]);

  return { element: current.element ?? null, isLoading };
}
