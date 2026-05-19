import { Chance } from 'chance';
import { HttpResponse, http } from 'msw';

import { type DashboardHit } from '@grafana/api-clients/rtkq/dashboard/v0alpha1';

import { wellFormedTree } from '../../../../fixtures/folders';

const [mockTree] = wellFormedTree();

type FilterArray = Array<(v: (typeof mockTree)[number]) => boolean>;

const typeMap: Record<string, string> = {
  folder: 'folders',
  dashboard: 'dashboards',
};

const typeFilterMap: Record<string, string> = {
  folders: 'folder',
};

export const searchRoute = '/apis/dashboard.grafana.app/v0alpha1/namespaces/:namespace/search';

type HitFilterArray = Array<(hit: DashboardHit) => boolean>;

/**
 * Very similar to the default handler, but this takes a list of DashboardHit objects which will get filtered and then
 * returned without mapping. This means you can test more custom responses and object shapes as DashboardHit has
 * lots of optional fields.
 * @param hits
 */
export function getCustomSearchHandler(hits: DashboardHit[]) {
  return http.get(searchRoute, ({ request }) => {
    const url = new URL(request.url);
    // TODO: query filter
    const limitFilter = parseInt(url.searchParams.get('limit') || '', 10) || hits.length;
    const folderFilter = url.searchParams.get('folder') || null;
    const typeFilter = url.searchParams.getAll('type');
    const mappedTypeFilters = typeFilter.map((f) => typeMap[f] || f);
    const nameFilter = url.searchParams.getAll('name');
    const tagFilter = url.searchParams.getAll('tag');
    const ownerReferenceFilter = url.searchParams.getAll('ownerReference');
    const offset = parseInt(url.searchParams.get('offset') || '', 10) || 0;

    const filters: HitFilterArray = [];

    if (nameFilter.length > 0) {
      const filteredNameFilter = nameFilter.filter((name) => name !== 'general');
      filters.push((hit) => filteredNameFilter.includes(hit.name));
    }

    if (typeFilter.length > 0) {
      filters.push((hit) => mappedTypeFilters.includes(hit.resource));
    }

    if (tagFilter.length > 0) {
      filters.push((hit) => Boolean(hit.tags?.some((tag) => tagFilter.includes(tag))));
    }

    if (ownerReferenceFilter.length > 0) {
      filters.push((hit) =>
        Boolean(hit.ownerReferences?.some((ownerReference) => ownerReferenceFilter.includes(ownerReference)))
      );
    }

    if (folderFilter === 'general') {
      filters.push((hit) => hit.folder === undefined || hit.folder === 'general');
    } else if (folderFilter) {
      filters.push((hit) => hit.folder === folderFilter);
    }

    const filtered = hits.filter((hit) => filters.every((fn) => fn(hit)));
    const sliced = filtered.slice(offset, offset + limitFilter);

    return HttpResponse.json({
      totalHits: filtered.length,
      hits: sliced,
    });
  });
}

const getDefaultSearchHandler = () =>
  http.get(searchRoute, ({ request }) => {
    const limitFilter = new URL(request.url).searchParams.get('limit') || null;
    const folderFilter = new URL(request.url).searchParams.get('folder') || null;
    const typeFilters = new URL(request.url).searchParams.getAll('type');
    const nameFilter = new URL(request.url).searchParams.getAll('name');
    const mappedTypeFilters = typeFilters.map((f) => typeFilterMap[f] || f);
    const tagFilter = new URL(request.url).searchParams.getAll('tag');

    const filtered = mockTree.filter((filterItem) => {
      const filters: FilterArray = [
        // Filter UI items out of fixtures as... they're UI items 🤷
        ({ item }) => item.kind !== 'ui',
      ];

      if (nameFilter.length > 0) {
        const filteredNameFilter = nameFilter.filter((name) => name !== 'general');
        filters.push(({ item }) => filteredNameFilter.includes(item.uid));
      }

      if (mappedTypeFilters.length > 0) {
        filters.push(({ item }) => mappedTypeFilters.includes(item.kind));
      }

      if (tagFilter.length > 0) {
        filters.push(({ item }) =>
          Boolean(
            (item.kind === 'folder' || item.kind === 'dashboard') && item.tags?.some((tag) => tagFilter.includes(tag))
          )
        );
      }

      if (folderFilter === 'general') {
        filters.push(
          ({ item }) => (item.kind === 'folder' || item.kind === 'dashboard') && item.parentUID === undefined
        );
      } else if (folderFilter) {
        filters.push(
          ({ item }) => (item.kind === 'folder' || item.kind === 'dashboard') && item.parentUID === folderFilter
        );
      }

      return filters.every((filterPredicate) => filterPredicate(filterItem));
    });

    const mapped = filtered.map(({ item }) => {
      const random = Chance(item.uid);
      const parentFolder = 'parentUID' in item ? item.parentUID : undefined;
      return {
        resource: typeMap[item.kind],
        name: item.uid,
        title: item.title,
        folder: parentFolder,
        field: {
          // Generate mock deprecated IDs only in the mock handlers - not generating in
          // mock data as it would require updating/tracking in the types as well
          'grafana.app/deprecatedInternalID': random.integer({ min: 1, max: 1000 }),
        },
      };
    });

    const sliced = limitFilter ? mapped.slice(0, parseInt(limitFilter, 10)) : mapped;

    return HttpResponse.json({
      totalHits: filtered.length,
      hits: sliced,
    });
  });

export default [getDefaultSearchHandler()];
