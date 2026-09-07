import { skipToken } from '@reduxjs/toolkit/query';
import { act, getWrapper, renderHook, waitFor } from 'test/test-utils';

import { type Notebook, useListNotebookQuery } from 'app/api/clients/dashboard/v2beta1';
import { useGetDisplayMappingQuery } from 'app/api/clients/iam/v0alpha1';
import { contextSrv } from 'app/core/services/context_srv';
import { defaultSpec as defaultNotebookSpec } from 'app/features/notebook/types';

import { type ResultItem, type SearchResults, useSearchNotebooksInfiniteQuery } from './notebookSearchApi';
import { __resetSearchAvailabilityForTests, NOTEBOOKS_PAGE_LIMIT, useNotebooksList } from './useNotebooksList';

jest.mock('app/api/clients/iam/v0alpha1', () => ({
  useGetDisplayMappingQuery: jest.fn(),
}));

jest.mock('app/api/clients/dashboard/v2beta1', () => ({
  useListNotebookQuery: jest.fn(),
}));

jest.mock('./notebookSearchApi', () => ({
  useSearchNotebooksInfiniteQuery: jest.fn(),
}));

const mockUseGetDisplayMappingQuery = jest.mocked(useGetDisplayMappingQuery);
const mockUseListNotebookQuery = jest.mocked(useListNotebookQuery);
const mockUseSearchNotebooksQuery = jest.mocked(useSearchNotebooksInfiniteQuery);

const CREATED_MS = Date.UTC(2026, 0, 1);
const UPDATED_MS = Date.UTC(2026, 1, 1);

function makeHit(overrides: {
  name: string;
  title?: string;
  tags?: string[];
  createdBy?: string;
  created?: number;
  updated?: number;
}): ResultItem {
  return {
    resource: { group: 'dashboard.grafana.app', resource: 'notebooks', kind: 'Notebook', name: overrides.name },
    fields: {
      ...(overrides.title !== undefined ? { title: overrides.title } : {}),
      ...(overrides.tags ? { tags: overrides.tags } : {}),
      ...(overrides.createdBy ? { createdBy: overrides.createdBy } : {}),
      ...(overrides.created !== undefined ? { created: overrides.created } : {}),
      ...(overrides.updated !== undefined ? { updated: overrides.updated } : {}),
    },
  };
}

interface SearchExtras {
  isLoading?: boolean;
  error?: unknown;
  continueToken?: string;
  totalHits?: number;
  totalHitsRelation?: SearchResults['metadata']['totalHitsRelation'];
  /** Whether the endpoint would offer another page — false with a token still set means the ceiling. */
  hasNextPage?: boolean;
  isFetching?: boolean;
  isError?: boolean;
  /**
   * These results belong to a previous argument: RTK Query still reports them as `data` while the
   * request for the current filters is in flight, but not as `currentData`.
   */
  staleData?: boolean;
  /**
   * The error landed partway through the cursor walk, so the pages that did load are still held
   * alongside it. Without this an error means nothing came back at all.
   */
  errorAfterPages?: boolean;
}

const mockFetchNextPage = jest.fn();

/** One page of results, as the endpoint returns it. */
function searchPage(items: ResultItem[], extra: SearchExtras = {}): SearchResults {
  return {
    items,
    metadata: {
      continue: extra.continueToken,
      totalHits: extra.totalHits ?? items.length,
      totalHitsRelation: extra.totalHitsRelation ?? 'eq',
    },
  };
}

/** Stands in for the infinite query: the pages accumulated so far, plus the paging controls. */
function setSearchPages(pages: SearchResults[], extra: SearchExtras = {}) {
  const data =
    extra.error && !extra.errorAfterPages
      ? undefined
      : { pages, pageParams: pages.map((_, i) => (i === 0 ? undefined : `cursor-${i}`)) };
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- partial RTK Query result is all the hook reads
  mockUseSearchNotebooksQuery.mockReturnValue({
    data,
    // What RTK Query holds for the argument being asked about right now, as opposed to the last
    // successful answer for any argument. `staleData` is how a test says "these results belong to
    // the previous filters, the new ones are still in flight".
    currentData: extra.staleData ? undefined : data,
    isLoading: extra.isLoading ?? false,
    isFetching: extra.isFetching ?? false,
    isFetchingNextPage: false,
    isError: extra.isError ?? Boolean(extra.error),
    hasNextPage: extra.hasNextPage ?? false,
    fetchNextPage: mockFetchNextPage,
    error: extra.error,
  } as unknown as ReturnType<typeof useSearchNotebooksInfiniteQuery>);
}

function setSearch(items: ResultItem[], extra: SearchExtras = {}) {
  setSearchPages([searchPage(items, extra)], extra);
}

/** Resolves the given uids to display names, as the iam endpoint would. */
function setDisplayNames(names: Record<string, string>) {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- partial RTK Query result is all the hook reads
  mockUseGetDisplayMappingQuery.mockReturnValue({
    data: {
      keys: Object.keys(names).map((uid) => `user:${uid}`),
      display: Object.entries(names).map(([uid, displayName]) => ({
        identity: { type: 'user', name: uid },
        displayName,
      })),
    },
  } as unknown as ReturnType<typeof useGetDisplayMappingQuery>);
}

/** A page the server filled to the limit, which is what truncation looks like on the wire. */
function fullPage(): ResultItem[] {
  return Array.from({ length: NOTEBOOKS_PAGE_LIMIT }, (_, i) => makeHit({ name: `nb${i}`, title: `Notebook ${i}` }));
}

/** The route-missing failure that makes the hook fall back to LIST. */
function setSearchRouteMissing(status = 404) {
  setSearch([], { error: { status, data: { message: 'not found' }, config: { url: '' } } });
}

function makeNotebook(
  overrides: {
    name: string;
    title: string;
    tags?: string[];
    createdBy?: string;
    created?: string;
    updated?: string;
  } // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- minimal fixture standing in for a full k8s resource
): Notebook {
  return {
    metadata: {
      name: overrides.name,
      creationTimestamp: overrides.created ?? '2026-01-01T00:00:00Z',
      annotations: {
        ...(overrides.createdBy ? { 'grafana.app/createdBy': overrides.createdBy } : {}),
        ...(overrides.updated ? { 'grafana.app/updatedTimestamp': overrides.updated } : {}),
      },
    },
    spec: {
      ...defaultNotebookSpec(),
      // The schema and generated-client element unions are nominally distinct; these fixtures
      // have no elements, so state that rather than casting the spec across the seam.
      elements: {},
      title: overrides.title,
      tags: overrides.tags ?? [],
    },
  };
}

function setList(items: Notebook[], extra: { isLoading?: boolean; error?: unknown; continueToken?: string } = {}) {
  const data = { items, metadata: { continue: extra.continueToken } };
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- partial RTK Query result is all the hook reads
  mockUseListNotebookQuery.mockReturnValue({
    data,
    currentData: data,
    isLoading: extra.isLoading ?? false,
    error: extra.error,
  } as unknown as ReturnType<typeof useListNotebookQuery>);
}

function setupHook(enabled = true) {
  const wrapper = getWrapper({ renderWithRouter: false });
  return renderHook(() => useNotebooksList({ enabled }), { wrapper });
}

/** The most recent body the hook asked the server for. */
function lastSearchArg() {
  const calls = mockUseSearchNotebooksQuery.mock.calls;
  return calls[calls.length - 1][0];
}

/** contextSrv.user is a plain property, so tests that swap it register their own undo here. */
const afterEachRestore: Array<() => void> = [];

describe('useNotebooksList', () => {
  afterEach(() => {
    while (afterEachRestore.length) {
      afterEachRestore.pop()?.();
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // The availability latch is module state by design, so each case starts from "unknown".
    __resetSearchAvailabilityForTests();
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- partial RTK Query result is all the hook reads
    mockUseGetDisplayMappingQuery.mockReturnValue({ data: undefined } as unknown as ReturnType<
      typeof useGetDisplayMappingQuery
    >);
    setSearch([]);
    setList([]);
  });

  describe('the request', () => {
    it('projects only the fields the table renders', () => {
      setupHook();

      // The point of the migration: LIST cannot ask for less than the whole notebook.
      expect(lastSearchArg()).toMatchObject({
        fields: ['title', 'tags', 'createdBy', 'created', 'updated'],
        limit: NOTEBOOKS_PAGE_LIMIT,
      });
    });

    it('omits where when nothing is filtered, so every notebook matches', () => {
      setupHook();

      expect(lastSearchArg()).not.toHaveProperty('where');
    });

    it('never sorts on created or updated, which the API rejects', () => {
      setupHook();

      // Both are retrieve-only server-side; asking to sort on them is a 422.
      expect(lastSearchArg()).not.toHaveProperty('sort');
    });

    it('sends a bare text leaf when only a title is searched', async () => {
      const { result } = setupHook();

      act(() => {
        result.current.setSearchQuery('checkout');
      });

      await waitFor(() => {
        expect(lastSearchArg()).toMatchObject({ where: { text: { value: 'checkout' } } });
      });
    });

    it('trims the search term before sending it', async () => {
      const { result } = setupHook();

      act(() => {
        result.current.setSearchQuery('  checkout  ');
      });

      await waitFor(() => {
        expect(lastSearchArg()).toMatchObject({ where: { text: { value: 'checkout' } } });
      });
    });

    it('sends a bare filter leaf when only the author is filtered', async () => {
      const originalUser = contextSrv.user;
      contextSrv.user = { ...originalUser, uid: 'me' };
      afterEachRestore.push(() => {
        contextSrv.user = originalUser;
      });

      const { result } = setupHook();

      act(() => {
        result.current.setCreatedByMe(true);
      });

      await waitFor(() => {
        expect(lastSearchArg()).toMatchObject({
          where: { filter: { field: 'createdBy', operator: 'In', values: ['user:me'] } },
        });
      });
    });

    // v1 accepts a single leaf or one `and` of leaves, so two predicates have to be combined
    // rather than nested any deeper.
    it('combines both predicates under a single and', async () => {
      const originalUser = contextSrv.user;
      contextSrv.user = { ...originalUser, uid: 'me' };
      afterEachRestore.push(() => {
        contextSrv.user = originalUser;
      });

      const { result } = setupHook();

      act(() => {
        result.current.setSearchQuery('checkout');
        result.current.setCreatedByMe(true);
      });

      await waitFor(() => {
        expect(lastSearchArg()).toMatchObject({
          where: {
            and: [
              { text: { value: 'checkout' } },
              { filter: { field: 'createdBy', operator: 'In', values: ['user:me'] } },
            ],
          },
        });
      });
    });

    it('does not filter by author when the user has no uid to filter on', async () => {
      const originalUser = contextSrv.user;
      contextSrv.user = { ...originalUser, uid: '' };
      afterEachRestore.push(() => {
        contextSrv.user = originalUser;
      });

      const { result } = setupHook();

      act(() => {
        result.current.setCreatedByMe(true);
      });

      // Sending an empty identity would match nothing at all.
      await waitFor(() => {
        expect(lastSearchArg()).not.toHaveProperty('where');
      });
    });

    it('skips the request when the feature is disabled', () => {
      setupHook(false);

      expect(mockUseSearchNotebooksQuery).toHaveBeenCalledWith(skipToken);
      expect(mockUseListNotebookQuery).toHaveBeenCalledWith(skipToken);
    });
  });

  describe('row derivation', () => {
    it('reads rows out of the projected fields', () => {
      setSearch([
        makeHit({
          name: 'nb1',
          title: 'Checkout error spike',
          tags: ['errors', 'checkout'],
          createdBy: 'user:abc',
          created: CREATED_MS,
          updated: UPDATED_MS,
        }),
      ]);

      const { result } = setupHook();

      expect(result.current.rows).toEqual([
        expect.objectContaining({
          uid: 'nb1',
          title: 'Checkout error spike',
          tags: ['errors', 'checkout'],
          authorUid: 'user:abc',
          created: CREATED_MS,
          updated: UPDATED_MS,
        }),
      ]);
    });

    // The uid comes off the envelope, not the projection: `name` has no retrieve capability,
    // so asking for it as a field would return nothing.
    it('takes the uid from the resource reference', () => {
      setSearch([makeHit({ name: 'nb1', title: 'One' })]);

      const { result } = setupHook();

      expect(result.current.rows[0].uid).toBe('nb1');
    });

    // The apiserver only writes an updated timestamp on update, so a notebook nobody has
    // touched since creating it has none — and the column would read blank.
    it('falls back to created when the notebook has never been updated', () => {
      setSearch([makeHit({ name: 'nb1', title: 'Never touched', created: CREATED_MS })]);

      const { result } = setupHook();

      expect(result.current.rows[0].updated).toBe(CREATED_MS);
    });

    it('survives fields the index never populated', () => {
      setSearch([{ resource: { group: 'g', resource: 'notebooks', kind: 'Notebook', name: 'nb1' } }]);

      const { result } = setupHook();

      expect(result.current.rows[0]).toEqual(
        expect.objectContaining({ uid: 'nb1', title: '', tags: [], created: 0, updated: 0 })
      );
    });

    it('ignores field values of the wrong shape', () => {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- deliberately malformed
      const malformed = {
        resource: { group: 'g', resource: 'notebooks', kind: 'Notebook', name: 'nb1' },
        fields: { title: 42, tags: ['ok', 7, null], created: 'yesterday' },
      } as unknown as ResultItem;
      setSearch([malformed]);

      const { result } = setupHook();

      expect(result.current.rows[0]).toEqual(expect.objectContaining({ title: '', tags: ['ok'], created: 0 }));
    });

    // Truncation is now only what the client refused to fetch: a token still on offer with no next
    // page left to ask for means the accumulation ceiling stopped the walk.
    it('reports truncation once the ceiling stops the walk', () => {
      setSearch(fullPage(), { continueToken: 'next-page', hasNextPage: false, totalHits: 870 });

      const { result } = setupHook();

      expect(result.current.isTruncated).toBe(true);
      expect(result.current.totalCount).toBe(870);
      expect(result.current.isTotalExact).toBe(true);
    });

    // A token means the next page is still coming, not that the list is cut short — including on a
    // short page, which the endpoint offers a cursor for whenever its total is inexact.
    it('is not truncated while pages are still being followed', () => {
      setSearch([makeHit({ name: 'nb1', title: 'One' })], {
        continueToken: 'next-page',
        hasNextPage: true,
        totalHits: 12,
        totalHitsRelation: 'lte',
      });

      const { result } = setupHook();

      expect(result.current.isTruncated).toBe(false);
      expect(result.current.isLoadingMore).toBe(true);
    });

    it('flags an inexact total so it is not printed as a precise number', () => {
      setSearch([makeHit({ name: 'nb1', title: 'One' })], { totalHits: 5000, totalHitsRelation: 'lte' });

      const { result } = setupHook();

      expect(result.current.isTotalExact).toBe(false);
    });

    it('is not truncated when the server returns everything it matched', () => {
      setSearch([makeHit({ name: 'nb1', title: 'One' })]);

      const { result } = setupHook();

      expect(result.current.isLoadingMore).toBe(false);
      expect(result.current.isTruncated).toBe(false);
    });
  });

  describe('tag filtering', () => {
    // `In` is set membership, so one leaf listing both tags would match a notebook carrying either.
    // Selecting two tags has to narrow, which an `and` of one leaf each expresses.
    it('sends a leaf per tag, so several tags narrow rather than widen', async () => {
      const { result } = setupHook();

      act(() => {
        result.current.setTagFilter(['latency', 'slo']);
      });

      await waitFor(() =>
        expect(lastSearchArg()).toMatchObject({
          where: {
            and: [
              { filter: { field: 'tags', operator: 'In', values: ['latency'] } },
              { filter: { field: 'tags', operator: 'In', values: ['slo'] } },
            ],
          },
        })
      );
    });

    it('combines tags with the search text', async () => {
      const { result } = setupHook();

      act(() => {
        result.current.setSearchQuery('checkout');
        result.current.setTagFilter(['errors']);
      });

      await waitFor(() =>
        expect(lastSearchArg()).toMatchObject({
          where: {
            and: [{ text: { value: 'checkout' } }, { filter: { field: 'tags', operator: 'In', values: ['errors'] } }],
          },
        })
      );
    });

    it('counts as filtered, so an empty result reads as no matches rather than no notebooks', async () => {
      const { result } = setupHook();

      expect(result.current.isFiltered).toBe(false);

      act(() => {
        result.current.setTagFilter(['latency']);
      });

      await waitFor(() => expect(result.current.isFiltered).toBe(true));
    });
  });

  describe('filtering state', () => {
    it('rows are whatever the server returned, without re-filtering', async () => {
      // Server-side filtering is the whole point; narrowing again here would hide a request
      // that went out with the wrong predicate.
      setSearch([makeHit({ name: 'nb1', title: 'Q2 latency regression' })]);

      const { result } = setupHook();

      act(() => {
        result.current.setSearchQuery('checkout');
      });

      await waitFor(() => {
        expect(result.current.isFiltered).toBe(true);
      });
      expect(result.current.rows.map((row) => row.uid)).toEqual(['nb1']);
    });

    it('is not filtered when the search box holds only whitespace', async () => {
      const { result } = setupHook();

      act(() => {
        result.current.setSearchQuery('   ');
      });

      await waitFor(() => {
        expect(lastSearchArg()).not.toHaveProperty('where');
      });
      expect(result.current.isFiltered).toBe(false);
    });
  });

  // The table sorts and counts whatever it holds, so a half-walked cursor would order a window
  // rather than the library.
  describe('following the cursor', () => {
    it('reads every page as one list', () => {
      setSearchPages([
        searchPage([makeHit({ name: 'nb1', title: 'One' })], { totalHits: 3 }),
        searchPage([makeHit({ name: 'nb2', title: 'Two' }), makeHit({ name: 'nb3', title: 'Three' })], {
          totalHits: 3,
        }),
      ]);

      const { result } = setupHook();

      expect(result.current.rows.map((row) => row.uid)).toEqual(['nb1', 'nb2', 'nb3']);
      expect(result.current.loadedCount).toBe(3);
      // The total comes from the first page, which counts the whole match set, not the page.
      expect(result.current.totalCount).toBe(3);
    });

    it('asks for the next page while one is on offer', () => {
      setSearch([makeHit({ name: 'nb1', title: 'One' })], { continueToken: 'next-page', hasNextPage: true });

      setupHook();

      expect(mockFetchNextPage).toHaveBeenCalled();
    });

    it('waits for the page in flight rather than stacking requests', () => {
      setSearch([makeHit({ name: 'nb1', title: 'One' })], {
        continueToken: 'next-page',
        hasNextPage: true,
        isFetching: true,
      });

      setupHook();

      expect(mockFetchNextPage).not.toHaveBeenCalled();
    });

    // A failed page leaves a cursor on offer. Retrying it from an effect would be an unbroken loop
    // of failing requests, so the walk has to stop at the first failure.
    it('stops walking after a page fails', () => {
      setSearch([makeHit({ name: 'nb1', title: 'One' })], {
        continueToken: 'next-page',
        hasNextPage: true,
        isError: true,
      });

      setupHook();

      expect(mockFetchNextPage).not.toHaveBeenCalled();
    });

    it('does not walk on the fallback path, where LIST cannot page', async () => {
      setSearchRouteMissing();
      setList([makeNotebook({ name: 'nb1', title: 'From list' })], { continueToken: 'next-page' });

      const { result } = setupHook();

      await waitFor(() => expect(result.current.rows).toHaveLength(1));
      expect(result.current.isLoadingMore).toBe(false);
    });
  });

  describe('author resolution', () => {
    it('resolves createdBy identities to display names', () => {
      setSearch([makeHit({ name: 'nb1', title: 'One', createdBy: 'user:abc' })]);
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- partial RTK Query result is all the hook reads
      mockUseGetDisplayMappingQuery.mockReturnValue({
        data: {
          keys: ['user:abc'],
          display: [{ identity: { type: 'user', name: 'abc' }, displayName: 'Marcus Chen' }],
        },
      } as unknown as ReturnType<typeof useGetDisplayMappingQuery>);

      const { result } = setupHook();

      expect(result.current.rows[0].authorName).toBe('Marcus Chen');
    });

    it('matches on identity rather than position', () => {
      // The server builds `display` from its query results and appends constants, so it is
      // neither in `keys` order nor the same length. Pairing by index would swap these names.
      setSearch([
        makeHit({ name: 'nb1', title: 'One', createdBy: 'user:aaa' }),
        makeHit({ name: 'nb2', title: 'Two', createdBy: 'user:bbb' }),
      ]);
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- partial RTK Query result is all the hook reads
      mockUseGetDisplayMappingQuery.mockReturnValue({
        data: {
          keys: ['user:aaa', 'user:bbb'],
          display: [
            { identity: { type: 'user', name: 'bbb' }, displayName: 'Priya Mehta' },
            { identity: { type: 'user', name: 'aaa' }, displayName: 'Marcus Chen' },
          ],
        },
      } as unknown as ReturnType<typeof useGetDisplayMappingQuery>);

      const { result } = setupHook();

      const byUid = Object.fromEntries(result.current.rows.map((row) => [row.uid, row.authorName]));
      expect(byUid).toEqual({ nb1: 'Marcus Chen', nb2: 'Priya Mehta' });
    });

    it('resolves a legacy numeric key through internalId', () => {
      // A createdBy value can carry the numeric id, which never appears as identity.name.
      setSearch([makeHit({ name: 'nb1', title: 'One', createdBy: 'user:1' })]);
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- partial RTK Query result is all the hook reads
      mockUseGetDisplayMappingQuery.mockReturnValue({
        data: {
          keys: ['user:1'],
          display: [{ identity: { type: 'user', name: 'abc' }, displayName: 'Marcus Chen', internalId: 1 }],
        },
      } as unknown as ReturnType<typeof useGetDisplayMappingQuery>);

      const { result } = setupHook();

      expect(result.current.rows[0].authorName).toBe('Marcus Chen');
    });

    it('drops a name the server did not return, rather than shifting it onto another row', () => {
      // Users the query cannot resolve are simply absent from `display`, so the arrays differ in
      // length as well as order.
      setSearch([
        makeHit({ name: 'nb1', title: 'One', createdBy: 'user:missing' }),
        makeHit({ name: 'nb2', title: 'Two', createdBy: 'user:bbb' }),
      ]);
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- partial RTK Query result is all the hook reads
      mockUseGetDisplayMappingQuery.mockReturnValue({
        data: {
          keys: ['user:missing', 'user:bbb'],
          display: [{ identity: { type: 'user', name: 'bbb' }, displayName: 'Priya Mehta' }],
        },
      } as unknown as ReturnType<typeof useGetDisplayMappingQuery>);

      const { result } = setupHook();

      const byUid = Object.fromEntries(result.current.rows.map((row) => [row.uid, row.authorName]));
      expect(byUid).toEqual({ nb1: 'Anonymous', nb2: 'Priya Mehta' });
    });

    it('falls back to Anonymous rather than leaking the identity key', () => {
      setSearch([makeHit({ name: 'nb1', title: 'One', createdBy: 'user:abc' })]);

      const { result } = setupHook();

      expect(result.current.rows[0].authorName).toBe('Anonymous');
    });

    it('stops asking once every author on screen is resolved', () => {
      setSearch([makeHit({ name: 'nb1', title: 'One', createdBy: 'user:abc' })]);
      setDisplayNames({ abc: 'Marcus Chen' });

      const { result } = setupHook();

      expect(result.current.rows[0].authorName).toBe('Marcus Chen');
      expect(mockUseGetDisplayMappingQuery).toHaveBeenLastCalledWith(skipToken);
    });

    // Filtering changes which authors are on screen. Re-deriving names from the latest response
    // would blank the column back to Anonymous until the next one arrived, and rebuild every row to
    // do it — so what is already known has to survive a narrowing.
    it('keeps names it already resolved when the author set narrows', async () => {
      setSearch([
        makeHit({ name: 'nb1', title: 'One', createdBy: 'user:abc' }),
        makeHit({ name: 'nb2', title: 'Two', createdBy: 'user:xyz' }),
      ]);
      setDisplayNames({ abc: 'Marcus Chen', xyz: 'Priya Mehta' });

      const { result, rerender } = setupHook();

      expect(result.current.rows[0].authorName).toBe('Marcus Chen');

      // What a narrowed filter looks like: fewer rows, and a display response not yet in hand.
      setSearch([makeHit({ name: 'nb1', title: 'One', createdBy: 'user:abc' })]);
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- partial RTK Query result is all the hook reads
      mockUseGetDisplayMappingQuery.mockReturnValue({ data: undefined } as unknown as ReturnType<
        typeof useGetDisplayMappingQuery
      >);
      rerender();

      expect(result.current.rows).toHaveLength(1);
      expect(result.current.rows[0].authorName).toBe('Marcus Chen');
    });

    it('skips the display lookup when no notebook has an author', () => {
      setSearch([makeHit({ name: 'nb1', title: 'One' })]);

      setupHook();

      // skipToken is passed rather than an empty key list, which the endpoint would reject.
      expect(mockUseGetDisplayMappingQuery).toHaveBeenCalledWith(skipToken);
    });
  });

  // The search route is mounted from an ini key that is off by default and is not reported in
  // frontend settings, so the page has to survive its absence.
  describe('when the search endpoint is not served', () => {
    it('falls back to LIST on a 404', async () => {
      setSearchRouteMissing();
      setList([makeNotebook({ name: 'nb1', title: 'From list' })]);

      const { result } = setupHook();

      await waitFor(() => {
        expect(result.current.rows.map((row) => row.uid)).toEqual(['nb1']);
      });
      expect(mockUseListNotebookQuery).toHaveBeenLastCalledWith({ limit: NOTEBOOKS_PAGE_LIMIT });
      // The fallback is not a failure the user should see.
      expect(result.current.error).toBeUndefined();
    });

    it('falls back on a 405 as well', async () => {
      setSearchRouteMissing(405);
      setList([makeNotebook({ name: 'nb1', title: 'From list' })]);

      const { result } = setupHook();

      await waitFor(() => {
        expect(result.current.rows.map((row) => row.uid)).toEqual(['nb1']);
      });
    });

    it('converts list timestamps to millis so the table gets one shape', async () => {
      setSearchRouteMissing();
      setList([
        makeNotebook({
          name: 'nb1',
          title: 'From list',
          created: '2026-01-01T00:00:00Z',
          updated: '2026-02-01T00:00:00Z',
        }),
      ]);

      const { result } = setupHook();

      await waitFor(() => {
        expect(result.current.rows[0]).toEqual(expect.objectContaining({ created: CREATED_MS, updated: UPDATED_MS }));
      });
    });

    it('falls back to the creation timestamp when the notebook was never updated', async () => {
      setSearchRouteMissing();
      setList([makeNotebook({ name: 'nb1', title: 'Never touched', created: '2026-01-01T00:00:00Z' })]);

      const { result } = setupHook();

      await waitFor(() => {
        expect(result.current.rows[0].updated).toBe(CREATED_MS);
      });
    });

    it('filters client-side, since the server did none', async () => {
      setSearchRouteMissing();
      setList([
        makeNotebook({ name: 'nb1', title: 'Checkout error spike' }),
        makeNotebook({ name: 'nb2', title: 'Q2 latency regression' }),
      ]);

      const { result } = setupHook();

      act(() => {
        result.current.setSearchQuery('CHECKOUT');
      });

      await waitFor(() => {
        expect(result.current.rows.map((row) => row.uid)).toEqual(['nb1']);
      });
    });

    // The search path sends the tags as predicates; on this path nothing did, so the same narrowing
    // has to happen here or the filter would silently do nothing wherever search is not served.
    it('narrows by every selected tag, not any of them', async () => {
      setSearchRouteMissing();
      setList([
        makeNotebook({ name: 'nb1', title: 'Both', tags: ['latency', 'slo'] }),
        makeNotebook({ name: 'nb2', title: 'One of them', tags: ['latency'] }),
        makeNotebook({ name: 'nb3', title: 'Neither', tags: ['checkout'] }),
      ]);

      const { result } = setupHook();

      act(() => {
        result.current.setTagFilter(['latency', 'slo']);
      });

      await waitFor(() => {
        expect(result.current.rows.map((row) => row.uid)).toEqual(['nb1']);
      });
    });

    it('reports what it loaded rather than inventing a total LIST never gave', async () => {
      setSearchRouteMissing();
      setList([makeNotebook({ name: 'nb1', title: 'One' }), makeNotebook({ name: 'nb2', title: 'Two' })]);

      const { result } = setupHook();

      await waitFor(() => {
        expect(result.current.loadedCount).toBe(2);
      });
      expect(result.current.totalCount).toBeUndefined();
    });

    // The opposite of the search path: LIST stops at its own byte limit before reaching the
    // requested count, so here a short page with a cursor is real truncation.
    it('treats a short LIST page with a continue token as truncated', async () => {
      setSearchRouteMissing();
      setList([makeNotebook({ name: 'nb1', title: 'One' })], { continueToken: 'next-page' });

      const { result } = setupHook();

      await waitFor(() => {
        expect(result.current.isTruncated).toBe(true);
      });
    });

    // Every page asks the same URL, so only a 404 with nothing loaded says the route is absent. One
    // partway through the walk is transient — a pod restarting mid-deploy, a proxy answering for it
    // — and abandoning search for the session on it would hide the failure behind stale-looking
    // rows.
    it('does not fall back when a 404 lands partway through the walk', async () => {
      setSearchPages([searchPage([makeHit({ name: 'nb1', title: 'From search' })], { continueToken: 'next-page' })], {
        error: { status: 404, data: { message: 'not found' }, config: { url: '' } },
        errorAfterPages: true,
      });
      setList([makeNotebook({ name: 'nb-from-list', title: 'From list' })]);

      const { result } = setupHook();

      expect(result.current.rows.map((row) => row.uid)).toEqual(['nb1']);
      expect(result.current.error).toEqual(expect.objectContaining({ status: 404 }));
      expect(mockUseListNotebookQuery).toHaveBeenCalledWith(skipToken);
    });

    // Same class of bug as the mid-walk case, reached through a new cache key instead: `currentData`
    // is empty on every filter change, so it cannot tell "the route never answered" from "it has
    // not answered for these filters yet".
    it('does not fall back when a 404 lands on a new filter after an earlier query answered', async () => {
      setSearch([makeHit({ name: 'nb1', title: 'From search' })]);
      setList([makeNotebook({ name: 'nb-from-list', title: 'From list' })]);

      const { result } = setupHook();

      // The route answered once, so it is served here.
      expect(result.current.rows.map((row) => row.uid)).toEqual(['nb1']);

      // A new filter is a new cache key, so nothing is held for it — and this one 404s.
      setSearchRouteMissing();
      act(() => {
        result.current.setSearchQuery('checkout');
      });

      await waitFor(() => {
        expect(result.current.error).toEqual(expect.objectContaining({ status: 404 }));
      });
      expect(mockUseListNotebookQuery).toHaveBeenCalledWith(skipToken);
    });

    it('stops asking for the search route once it is known to be missing', async () => {
      setSearchRouteMissing();
      setList([makeNotebook({ name: 'nb1', title: 'From list' })]);

      const { result } = setupHook();

      await waitFor(() => {
        expect(result.current.rows).toHaveLength(1);
      });

      act(() => {
        result.current.setSearchQuery('checkout');
      });

      // Every keystroke would otherwise be a new cache key and a fresh 404.
      await waitFor(() => {
        expect(mockUseSearchNotebooksQuery).toHaveBeenLastCalledWith(skipToken);
      });
    });
  });

  it('surfaces a real error rather than falling back', () => {
    setSearch([], { error: { status: 500, data: { message: 'boom' }, config: { url: '' } } });

    const { result } = setupHook();

    expect(result.current.error).toEqual(expect.objectContaining({ status: 500 }));
    expect(mockUseListNotebookQuery).toHaveBeenCalledWith(skipToken);
  });

  // The walk halts on a failure but leaves a next page on offer, so "still loading" would never
  // resolve — and it would sit next to the error that stopped it.
  it('stops reporting more on the way once a page has failed', () => {
    setSearchPages([searchPage([makeHit({ name: 'nb1', title: 'One' })], { continueToken: 'next' })], {
      hasNextPage: true,
      isError: true,
    });

    const { result } = setupHook();

    expect(result.current.isLoadingMore).toBe(false);
  });

  // RTK Query holds the last successful answer while a new argument loads. Serving it would show the
  // previous filter's rows and counts underneath the new one.
  describe('while a new set of filters is loading', () => {
    it('reports no rows rather than the previous filter’s', () => {
      setSearch([makeHit({ name: 'nb1', title: 'One' })], { staleData: true, isFetching: true });

      const { result } = setupHook();

      expect(result.current.rows).toEqual([]);
    });

    it('reports no counts rather than the previous filter’s', () => {
      setSearch([makeHit({ name: 'nb1', title: 'One' })], {
        staleData: true,
        isFetching: true,
        totalHits: 42,
      });

      const { result } = setupHook();

      expect(result.current.totalCount).toBe(0);
      expect(result.current.loadedCount).toBe(0);
    });

    it('says it is reloading, not loading, once something has been shown', async () => {
      setSearch([makeHit({ name: 'nb1', title: 'One' })]);

      const { result, rerender } = setupHook();

      await waitFor(() => expect(result.current.rows).toHaveLength(1));
      expect(result.current.isReloading).toBe(false);

      setSearch([makeHit({ name: 'nb1', title: 'One' })], { staleData: true, isFetching: true });
      rerender();

      expect(result.current.isReloading).toBe(true);
      // Not isLoading: the page swaps its whole body out for that, which would unmount the filter
      // input and take the caret with it, mid-typing.
      expect(result.current.isLoading).toBe(false);
    });

    it('is loading rather than reloading before anything has been shown', () => {
      setSearch([], { isLoading: true, isFetching: true, staleData: true });

      const { result } = setupHook();

      expect(result.current.isLoading).toBe(true);
      expect(result.current.isReloading).toBe(false);
    });
  });

  // The table resets its page index by being remounted, so this has to change when the committed
  // filters do — and not when rows merely accumulate.
  describe('filterKey', () => {
    it('changes when the author filter is applied', async () => {
      setSearch([makeHit({ name: 'nb1', title: 'One' })]);
      contextSrv.user = { ...contextSrv.user, uid: 'me' };
      afterEachRestore.push(() => {
        contextSrv.user = { ...contextSrv.user, uid: '' };
      });

      const { result } = setupHook();
      const before = result.current.filterKey;

      act(() => {
        result.current.setCreatedByMe(true);
      });

      await waitFor(() => expect(result.current.filterKey).not.toBe(before));
    });

    it('does not change as more pages arrive', async () => {
      setSearchPages([searchPage([makeHit({ name: 'nb1', title: 'One' })], { continueToken: 'next' })], {
        hasNextPage: true,
      });

      const { result, rerender } = setupHook();
      const before = result.current.filterKey;

      setSearchPages([
        searchPage([makeHit({ name: 'nb1', title: 'One' })], { continueToken: 'next' }),
        searchPage([makeHit({ name: 'nb2', title: 'Two' })]),
      ]);
      rerender();

      await waitFor(() => expect(result.current.rows).toHaveLength(2));
      expect(result.current.filterKey).toBe(before);
    });
  });
});
