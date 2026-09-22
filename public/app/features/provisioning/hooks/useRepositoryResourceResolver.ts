import { useEffect, useMemo, useRef } from 'react';

import { provisioningAPIv0alpha1, type ResourceListItem } from 'app/api/clients/provisioning/v0alpha1';
import { getState } from 'app/store/store';
import { useDispatch } from 'app/types/store';

const MAX_BATCH_SIZE = 100;
const MAX_CACHE_AGE_MS = 60_000;

interface Request<T> {
  abort: () => void;
  unsubscribe: () => void;
  unwrap: () => Promise<T>;
}

export function useRepositoryResourceResolver(name: string, syncFinished: number | undefined) {
  const dispatch = useDispatch();
  const previousSyncRef = useRef(syncFinished);
  const cleanupRef = useRef<Promise<unknown>>(Promise.resolve());

  const resolver = useMemo(() => {
    const pending = new Map<string, Promise<ResourceListItem[]>>();
    const requests = new Set<{ abort: () => void }>();
    let active = false;
    let generation = 0;

    const getCached = (path: string): ResourceListItem[] | undefined => {
      const state = getState();
      const entry =
        path === '/'
          ? provisioningAPIv0alpha1.endpoints.getRepositoryResources.select({ name })(state)
          : provisioningAPIv0alpha1.endpoints.resolveRepositoryResources.select({
              name,
              resourceResolveRequest: { paths: [path] },
            })(state);
      if (
        !entry.isSuccess ||
        entry.fulfilledTimeStamp === undefined ||
        (entry.startedTimeStamp ?? 0) < (syncFinished ?? 0) ||
        Date.now() - entry.fulfilledTimeStamp >= MAX_CACHE_AGE_MS
      ) {
        return undefined;
      }
      if (entry.data && 'results' in entry.data) {
        const resource = entry.data.results.find((result) => result.path === path)?.resource;
        return resource ? [resource] : undefined;
      }
      return entry.data && 'items' in entry.data ? (entry.data.items ?? []) : undefined;
    };

    const requestBatch = (paths: string[]) => {
      const token = generation;
      const isCurrent = () => active && generation === token;

      const execute = async <T>(createRequest: () => Request<T>): Promise<T> => {
        // A previous render may have aborted a request with the same RTK query key.
        for (let attempt = 0; ; attempt++) {
          const request = createRequest();
          requests.add(request);
          try {
            // Keep the subscription until unwrap reads the cache so delayed invalidation cannot remove its result.
            return await request.unwrap();
          } catch (error) {
            if (
              attempt > 0 ||
              !isCurrent() ||
              typeof error !== 'object' ||
              error === null ||
              !('name' in error) ||
              error.name !== 'AbortError'
            ) {
              throw error;
            }
          } finally {
            request.unsubscribe();
            requests.delete(request);
          }
        }
      };

      const batch = (async () => {
        await cleanupRef.current;
        const resources = new Map<string, ResourceListItem[]>();
        if (!isCurrent()) {
          return resources;
        }
        if (paths[0] === '/') {
          const result = await execute(() =>
            dispatch(
              provisioningAPIv0alpha1.endpoints.getRepositoryResources.initiate(
                { name },
                { subscribe: true, forceRefetch: true }
              )
            )
          );
          if (isCurrent()) {
            resources.set('/', result.items ?? []);
          }
          return resources;
        }
        const result = await execute(() =>
          dispatch(
            provisioningAPIv0alpha1.endpoints.resolveRepositoryResources.initiate(
              { name, resourceResolveRequest: { paths } },
              { subscribe: true, forceRefetch: true }
            )
          )
        );
        if (isCurrent()) {
          const resolved = result.results.filter((entry) => entry.resource && paths.includes(entry.path));
          dispatch(
            provisioningAPIv0alpha1.util.upsertQueryEntries(
              resolved.map((entry) => ({
                endpointName: 'resolveRepositoryResources' as const,
                arg: { name, resourceResolveRequest: { paths: [entry.path] } },
                value: { results: [entry] },
              }))
            )
          );
          for (const entry of resolved) {
            if (entry.resource) {
              resources.set(entry.path, [entry.resource]);
            }
          }
        }
        return resources;
      })().catch(() => new Map<string, ResourceListItem[]>());

      for (const path of paths) {
        const result = batch.then((resources) => resources.get(path) ?? []);
        pending.set(path, result);
        void result.finally(() => {
          if (pending.get(path) === result) {
            pending.delete(path);
          }
        });
      }
    };

    return {
      getCached,
      resolve(path: string) {
        const cached = getCached(path);
        if (cached) {
          return Promise.resolve(cached);
        }
        if (!pending.has(path)) {
          requestBatch([path]);
        }
        return pending.get(path)!;
      },
      prefetch(paths: string[]) {
        const missing = [...new Set(paths)].filter((path) => path !== '/' && !getCached(path) && !pending.has(path));
        for (let index = 0; index < missing.length; index += MAX_BATCH_SIZE) {
          requestBatch(missing.slice(index, index + MAX_BATCH_SIZE));
        }
      },
      activate() {
        active = true;
      },
      dispose() {
        active = false;
        generation += 1;
        for (const request of requests) {
          request.abort();
        }
        // Wait for aborted queries to settle before a new sync starts the same query keys.
        cleanupRef.current = Promise.allSettled([...pending.values()]);
        pending.clear();
      },
    };
  }, [dispatch, name, syncFinished]);

  useEffect(() => {
    resolver.activate();
    return () => resolver.dispose();
  }, [resolver]);

  useEffect(() => {
    if (previousSyncRef.current !== syncFinished) {
      previousSyncRef.current = syncFinished;
      dispatch(provisioningAPIv0alpha1.util.invalidateTags([{ type: 'Repository', id: `resources:${name}` }]));
    }
  }, [dispatch, name, syncFinished]);

  return resolver;
}
