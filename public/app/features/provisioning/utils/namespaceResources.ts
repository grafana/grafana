import {
  type ListNamespaceResourcesApiArg,
  type ResourceListItem,
  provisioningAPIv0alpha1,
} from 'app/api/clients/provisioning/v0alpha1';
import { type AppDispatch } from 'app/store/configureStore';

const PAGE_SIZE = 500;
// Guardrail so a pathological response can't spin off unbounded requests. Exceeding it throws
// rather than returning a silently truncated list, which would drop rows from the migrate table.
const MAX_PAGES = 200;

/**
 * Every resource the namespace list returns for `args`, following the continue token to the end.
 *
 * Read through the generated client imperatively rather than with its hook: paging is sequential,
 * and the caller wants the whole set, not one page per render.
 */
export async function listNamespaceResources(
  dispatch: AppDispatch,
  args: ListNamespaceResourcesApiArg = {}
): Promise<ResourceListItem[]> {
  const items: ResourceListItem[] = [];
  let cursor: string | undefined;

  for (let page = 0; page < MAX_PAGES; page++) {
    const response = await dispatch(
      provisioningAPIv0alpha1.endpoints.listNamespaceResources.initiate(
        { ...args, limit: PAGE_SIZE, continue: cursor },
        { forceRefetch: true, subscribe: false }
      )
    ).unwrap();
    items.push(...(response.items ?? []));
    cursor = response.metadata?.continue || undefined;
    if (!cursor) {
      return items;
    }
  }

  throw new Error(`Too many resources to enumerate (over ${MAX_PAGES * PAGE_SIZE}); aborting to avoid a partial list.`);
}
