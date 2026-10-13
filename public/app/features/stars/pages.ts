import { lastValueFrom } from 'rxjs';
import * as z from 'zod';

import { locationUtil } from '@grafana/data';
import { getBackendSrv, isFetchError } from '@grafana/runtime';
import { type StarredNavItem } from 'app/core/reducers/navBarTree';

export const PAGE_API_GROUP = 'assistant.ext.grafana.app';

const catalogBatch = z.object({
  data: z.object({
    pages: z.array(z.object({ id: z.string().uuid(), title: z.string() })),
    nextCursor: z.string().optional(),
  }),
});

/** The catalog authorizes both folder and unlisted Pages before returning their titles. */
export async function loadStarredPages(names: string[], limit: number): Promise<StarredNavItem[]> {
  if (names.length === 0 || limit <= 0) {
    return [];
  }
  const starred = new Set(names);
  const items = new Map<string, StarredNavItem>();
  let cursor: string | undefined;
  // Catalog permission scans can return short or empty batches with a continuation.
  // Bound the work even if most saved stars are no longer readable.
  for (let batch = 0; batch < 5; batch++) {
    let data: unknown;
    try {
      const response = await lastValueFrom(
        getBackendSrv().fetch<unknown>({
          url: '/api/plugins/grafana-assistant-app/resources/api/v1/page-catalog',
          params: { section: 'starred', limit, ...(cursor ? { cursor } : {}) },
          showErrorAlert: false,
        })
      );
      data = response.data;
    } catch (error) {
      // A removed/disabled plugin or revoked catalog permission makes its stars inaccessible.
      if (isFetchError(error) && [403, 404].includes(error.status)) {
        return [];
      }
      throw error;
    }
    const result = catalogBatch.parse(data).data;
    for (const page of result.pages) {
      if (starred.has(page.id)) {
        items.set(page.id, {
          id: `page:${page.id}`,
          title: page.title,
          url: locationUtil.assureBaseUrl(`/a/grafana-assistant-app/pages/${page.id}`),
          icon: 'file-alt',
          sortWeight: 2,
        });
      }
      if (items.size === limit) {
        return [...items.values()];
      }
    }
    if (!result.nextCursor || result.nextCursor === cursor) {
      break;
    }
    cursor = result.nextCursor;
  }
  return [...items.values()];
}
