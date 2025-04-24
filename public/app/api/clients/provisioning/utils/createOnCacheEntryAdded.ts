import { Subscription } from 'rxjs';

import { ScopedResourceClient } from '../../../../features/apiserver/client';
import { ListOptions } from '../../../../features/apiserver/types';
import { ListMeta, ObjectMeta } from '../endpoints.gen';

/**
 * Creates a cache entry handler for RTK Query that watches for changes to a resource
 * and updates the cache accordingly.
 */
export function createOnCacheEntryAdded<
  Spec,
  Status,
  T extends { spec?: Spec; status?: Status; metadata?: ObjectMeta },
  List extends { items?: T[]; metadata?: ListMeta },
>(resourceName: string) {
  return async function onCacheEntryAdded(
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
          const existingIndex = draft.items.findIndex((item) => item.metadata?.name === event.object.metadata.name);

          if (event.type === 'ADDED' && existingIndex === -1) {
            // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
            draft.items.push(event.object as unknown as T);
          } else if (event.type === 'DELETED' && existingIndex !== -1) {
            // Remove the item if it exists
            draft.items.splice(existingIndex, 1);
          } else if (existingIndex !== -1) {
            // Could be ADDED or MODIFIED
            // Update the existing item if it exists
            // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
            draft.items[existingIndex] = event.object as unknown as T;
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
