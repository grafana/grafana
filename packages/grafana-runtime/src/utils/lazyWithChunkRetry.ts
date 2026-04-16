import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

const CHUNK_RELOAD_KEY = 'grafana-chunk-reload';

/**
 * Wraps React.lazy with a ChunkLoadError handler that performs a one-time
 * page reload when a chunk fails to load (e.g. after a plugin upgrade where
 * the browser has cached stale chunk references).
 *
 * Uses sessionStorage to prevent infinite reload loops.
 *
 * @public
 */
export function lazyWithChunkRetry<T extends ComponentType<unknown>>(
  factory: () => Promise<{ default: T }>
): LazyExoticComponent<T> {
  return lazy(() =>
    factory()
      .then((module) => {
        sessionStorage.removeItem(CHUNK_RELOAD_KEY);
        return module;
      })
      .catch((error) => {
        if (error?.name === 'ChunkLoadError' && !sessionStorage.getItem(CHUNK_RELOAD_KEY)) {
          sessionStorage.setItem(CHUNK_RELOAD_KEY, 'true');
          window.location.reload();
          // Keep the promise pending; page reload is imminent
          return new Promise<never>(() => {});
        }

        sessionStorage.removeItem(CHUNK_RELOAD_KEY);
        throw error;
      })
  );
}
