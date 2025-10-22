import { Chance } from 'chance';
import { HttpResponse, http } from 'msw';

import { wellFormedTree } from '../../../fixtures/folders';
import { mockStarredDashboardsMap } from '../../../fixtures/starred';

import { SORT_OPTIONS } from './constants';

const [mockTree] = wellFormedTree();

type FilterArray = Array<(v: (typeof mockTree)[number]) => boolean>;

const slugify = (str: string) => {
  return str
    .toLowerCase()
    .replace(/[^\w ]+/g, '')
    .replace(/ +/g, '-');
};

const getLegacySearchHandler = () =>
  http.get('/api/search', ({ request }) => {
    const folderFilter = new URL(request.url).searchParams.get('folderUIDs') || null;
    const typeFilter = new URL(request.url).searchParams.get('type') || null;
    // Workaround for the fixture kind being 'dashboard' instead of 'dash-db'
    const mappedTypeFilter = typeFilter === 'dash-db' ? 'dashboard' : typeFilter;
    const starredFilter = new URL(request.url).searchParams.get('starred') || null;
    const tagFilter = new URL(request.url).searchParams.getAll('tag') || null;

    const response = mockTree
      .filter((filterItem) => {
        const filters: FilterArray = [
          // Filter UI items out of fixtures as... they're UI items 🤷
          ({ item }) => item.kind !== 'ui',
        ];

        if (tagFilter && tagFilter.length > 0) {
          filters.push(({ item }) =>
            Boolean(
              (item.kind === 'folder' || item.kind === 'dashboard') && item.tags?.some((tag) => tagFilter.includes(tag))
            )
          );
        }

        if (starredFilter) {
          filters.push(({ item }) => mockStarredDashboardsMap.has(item.uid));
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

        if (mappedTypeFilter) {
          filters.push(({ item }) => item.kind === mappedTypeFilter);
        }

        return filters.every((filterPredicate) => filterPredicate(filterItem));
      })

      .map(({ item }) => {
        const random = Chance(item.uid);
        const slugified = slugify(item.title || '');
        const parentFolder =
          item.kind === 'dashboard'
            ? mockTree.find((t) => t.item.kind === 'folder' && t.item.uid === item.parentUID)
            : undefined;
        return {
          id: random.integer({ min: 1, max: 1000 }),
          uid: item.uid,
          orgId: 1,
          title: item.title,
          uri: `db/${slugified}`,
          url: `/d/${item.uid}/${slugified}`,
          folderUid: parentFolder?.item.uid,
          folderTitle: parentFolder?.item.title,
          slug: '',
          type: item.kind,
          tags: [],
          isStarred: false,
          sortMeta: 0,
          isDeleted: false,
        };
      });

    return HttpResponse.json(response);
  });

const getSearchSortingHandler = () => http.get('/api/search/sorting', () => HttpResponse.json(SORT_OPTIONS));

export default [getLegacySearchHandler(), getSearchSortingHandler()];
