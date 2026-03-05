import { Chance } from 'chance';
import { HttpResponse, http } from 'msw';

import { DashboardHit } from '@grafana/api-clients/rtkq/dashboard/v0alpha1';

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

const searchRoute = '/apis/dashboard.grafana.app/v0alpha1/namespaces/:namespace/search';

export function getCustomSearchHandler(options: { folders?: DashboardHit[]; dashboards?: DashboardHit[] }) {
  return http.get(searchRoute, ({ request }) => {
    const url = new URL(request.url);
    let hits: DashboardHit[] = [];
    const types = url.searchParams.getAll('type');
    if (types.includes('folder') || !types.length) {
      hits = hits.concat(options.folders ?? []);
    }
    if (types.includes('dashboard') || !types.length) {
      hits = hits.concat(options.dashboards ?? []);
    }
    return HttpResponse.json({
      hits: hits,
      totalHits: hits.length,
    });
  });
}

const getDefaultSearchHandler = () =>
  http.get(searchRoute, ({ request }) => {
    const limitFilter = new URL(request.url).searchParams.get('limit') || null;
    const folderFilter = new URL(request.url).searchParams.get('folder') || null;
    const typeFilter = new URL(request.url).searchParams.get('type') || null;
    const nameFilter = new URL(request.url).searchParams.getAll('name');
    const mappedTypeFilter = typeFilter ? typeFilterMap[typeFilter] || typeFilter : null;
    const tagFilter = new URL(request.url).searchParams.getAll('tag') || null;

    const filtered = mockTree.filter((filterItem) => {
      const filters: FilterArray = [
        // Filter UI items out of fixtures as... they're UI items 🤷
        ({ item }) => item.kind !== 'ui',
      ];

      if (nameFilter.length > 0) {
        const filteredNameFilter = nameFilter.filter((name) => name !== 'general');
        filters.push(({ item }) => filteredNameFilter.includes(item.uid));
      }

      if (typeFilter) {
        filters.push(({ item }) => item.kind === mappedTypeFilter);
      }

      if (tagFilter && tagFilter.length > 0) {
        filters.push(({ item }) =>
          Boolean(
            (item.kind === 'folder' || item.kind === 'dashboard') && item.tags?.some((tag) => tagFilter.includes(tag))
          )
        );
      }

      if (folderFilter && folderFilter !== 'general') {
        filters.push(
          ({ item }) => (item.kind === 'folder' || item.kind === 'dashboard') && item.parentUID === folderFilter
        );
      }

      if (folderFilter === 'general') {
        filters.push(
          ({ item }) => (item.kind === 'folder' || item.kind === 'dashboard') && item.parentUID === undefined
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
      totalHits: sliced.length,
      hits: sliced,
    });
  });

export default [getDefaultSearchHandler()];
