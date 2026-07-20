import { type ThunkDispatch, type UnknownAction } from '@reduxjs/toolkit';
import { type Subscription } from 'rxjs';

import { ScopedResourceClient } from 'app/features/apiserver/client';
import { type ListOptions, type GeneratedResourceList as ResourceList } from 'app/features/apiserver/types';

interface OnCacheEntryAddedOptions<List = unknown> {
  onError?: (
    error: unknown,
    updateCachedData: (fn: (draft: List) => void) => void,
    dispatch: ThunkDispatch<unknown, unknown, UnknownAction>,
    arg: ListOptions | undefined
  ) => (() => void) | undefined | void;
}

/**
 * Kubernetes treats resourceVersion as opaque, but Grafana's apiserver issues
 * monotonically increasing numeric versions per object. Comparing them lets us
 * drop stale/duplicate watch events (multiple interleaved watch streams can
 * deliver events out of order or more than once). Returns null when either
 * version is missing or non-numeric — callers must fail open and apply the event.
 */
function compareResourceVersions(a: string | undefined, b: string | undefined): number | null {
  if (!a || !b || !/^\d+$/.test(a) || !/^\d+$/.test(b)) {
    return null;
  }
  const x = BigInt(a);
  const y = BigInt(b);
  return x < y ? -1 : x > y ? 1 : 0;
}

/**
 * Creates a cache entry handler for RTK Query that watches for changes to a resource
 * and updates the cache accordingly.
 */
export function createOnCacheEntryAdded<Spec, Status>(
  resourceName: string,
  options: OnCacheEntryAddedOptions<ResourceList<Spec, Status>> = {}
) {
  return async function onCacheEntryAdded<List extends ResourceList<Spec, Status>>(
    arg: ListOptions | undefined,
    {
      updateCachedData,
      cacheDataLoaded,
      cacheEntryRemoved,
      dispatch,
    }: {
      updateCachedData: (fn: (draft: List) => void) => void;
      cacheDataLoaded: Promise<{ data: List }>;
      cacheEntryRemoved: Promise<void>;
      dispatch: ThunkDispatch<unknown, unknown, UnknownAction>;
    }
  ) {
    if (!arg?.watch) {
      return;
    }

    const client = new ScopedResourceClient<Spec, Status>({
      group: 'provisioning.grafana.app',
      version: 'v0alpha1',
      resource: resourceName,
    });

    let subscription: Subscription | null = null;
    const errorCleanup: { fn?: () => void } = {};
    try {
      // Wait for the initial query to resolve before proceeding
      const response = await cacheDataLoaded;
      const resourceVersion = response.data.metadata?.resourceVersion;

      subscription = client
        .watch({ resourceVersion, fieldSelector: arg?.fieldSelector, labelSelector: arg?.labelSelector })
        .subscribe({
          next: (event) => {
            updateCachedData((draft) => {
              if (!draft.items) {
                draft.items = [];
              }
              // Find the item with the matching name
              const existingIndex = draft.items.findIndex((item) => item.metadata?.name === event.object.metadata.name);
              const existing = existingIndex === -1 ? undefined : draft.items[existingIndex];
              const cmp = compareResourceVersions(
                event.object.metadata.resourceVersion,
                existing?.metadata?.resourceVersion
              );

              if (event.type === 'ADDED' && existingIndex === -1) {
                draft.items.push(event.object);
              } else if (event.type === 'DELETED' && existingIndex !== -1) {
                // Remove the item, unless the cached item is newer than the delete
                // event (a stale delete replayed after the object was re-created)
                if (cmp === null || cmp >= 0) {
                  draft.items.splice(existingIndex, 1);
                }
              } else if (existingIndex !== -1) {
                // Could be ADDED or MODIFIED. Only apply events newer than the cached
                // item: equal versions are duplicate deliveries, older ones are stale
                // and would flip the UI backward. Skipping leaves the draft untouched,
                // so RTK Query keeps the same state reference and no re-render fires.
                if (cmp === null || cmp > 0) {
                  draft.items[existingIndex] = event.object;
                }
              }
            });
          },
          error: (error) => {
            errorCleanup.fn = options.onError?.(error, updateCachedData, dispatch, arg) ?? undefined;
          },
        });
    } catch (error) {
      console.error('Error in onCacheEntryAdded:', error);
      return;
    }

    await cacheEntryRemoved;
    subscription?.unsubscribe();
    errorCleanup.fn?.();
  };
}
