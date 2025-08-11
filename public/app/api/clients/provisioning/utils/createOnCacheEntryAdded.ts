import { Subscription } from 'rxjs';

import { ScopedResourceClient } from 'app/features/apiserver/client';
import { ListOptions, GeneratedResourceList as ResourceList } from 'app/features/apiserver/types';

/**
 * Creates a cache entry handler for RTK Query that watches for changes to a resource
 * and updates the cache accordingly.
 */
export function createOnCacheEntryAdded<Spec, Status>(resourceName: string) {
  return async function onCacheEntryAdded<List extends ResourceList<Spec, Status>>(
    arg: ListOptions | undefined,
    {
      updateCachedData,
      cacheDataLoaded,
      cacheEntryRemoved,
    }: {
      updateCachedData: (fn: (draft: List) => void) => void;
      cacheDataLoaded: Promise<{ data: List }>;
      cacheEntryRemoved: Promise<void>;
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
    try {
      // Wait for the initial query to resolve before proceeding
      const response = await cacheDataLoaded;
      const resourceVersion = response.data.metadata?.resourceVersion;

      subscription = client.watch({ resourceVersion }).subscribe((event) => {
        updateCachedData((draft) => {
          if (!draft.items) {
            draft.items = [];
          }
          // Find the item with the matching name
          const existingIndex = draft.items.findIndex((item) => item.metadata?.name === event.object.metadata.name);

          if (event.type === 'ADDED' && existingIndex === -1) {
            draft.items.push(event.object);
          } else if (event.type === 'DELETED' && existingIndex !== -1) {
            // Remove the item if it exists
            draft.items.splice(existingIndex, 1);
          } else if (existingIndex !== -1) {
            // Could be ADDED or MODIFIED
            // Update the existing item if it exists
            draft.items[existingIndex] = event.object;
          }
        });
      });
    } catch (error) {
      console.error('Error in onCacheEntryAdded:', error);
    }

    await cacheEntryRemoved;
    subscription?.unsubscribe();
  };
}
