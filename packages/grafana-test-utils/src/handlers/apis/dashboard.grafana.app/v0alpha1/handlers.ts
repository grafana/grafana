import { Chance } from 'chance';
import { HttpResponse, http } from 'msw';

import { wellFormedTree } from '../../../../fixtures/folders';

const [mockTree] = wellFormedTree();

type FilterArray = Array<(v: (typeof mockTree)[number]) => boolean>;

const getSearchHandler = () =>
  http.get('/apis/dashboard.grafana.app/v0alpha1/namespaces/default/search', ({ request }) => {
    const folderFilter = new URL(request.url).searchParams.get('folder') || null;
    const typeFilter = new URL(request.url).searchParams.get('type') || null;
    const response = mockTree
      .filter((filterItem) => {
        const filters: FilterArray = [];
        if (folderFilter && folderFilter !== 'general') {
          filters.push(({ item }) => item.kind === 'folder' && item.parentUID === folderFilter);
        }

        if (folderFilter === 'general') {
          filters.push(({ item }) => item.kind === 'folder' && item.parentUID === undefined);
        }

        if (typeFilter) {
          filters.push(({ item }) => item.kind === typeFilter);
        }

        return filters.every((filterPredicate) => filterPredicate(filterItem));
      })

      .map(({ item }) => {
        const random = Chance(item.uid);
        return {
          resource: 'folders',
          name: item.uid,
          title: item.title,
          field: {
            // Generate mock deprecated IDs only in the mock handlers - not generating in
            // mock data as it would require updating/tracking in the types as well
            'grafana.app/deprecatedInternalID': random.integer({ min: 1, max: 1000 }),
          },
        };
      });

    return HttpResponse.json({
      totalHits: response.length,
      hits: response,
    });
  });

export default [getSearchHandler()];
