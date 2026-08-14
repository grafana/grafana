import { skipToken } from '@reduxjs/toolkit/query';
import { act, getWrapper, renderHook, waitFor } from 'test/test-utils';

import { type Notebook, useListNotebookQuery } from 'app/api/clients/dashboard/v2beta1';
import { useGetDisplayMappingQuery } from 'app/api/clients/iam/v0alpha1';
import { contextSrv } from 'app/core/services/context_srv';
import { defaultSpec as defaultNotebookSpec } from 'app/features/notebook/types';

import { type ResultItem, type SearchResults, useSearchNotebooksQuery } from './notebookSearchApi';
import { __resetSearchAvailabilityForTests, NOTEBOOKS_PAGE_LIMIT, useNotebooksList } from './useNotebooksList';

jest.mock('app/api/clients/iam/v0alpha1', () => ({
  useGetDisplayMappingQuery: jest.fn(),
}));

jest.mock('app/api/clients/dashboard/v2beta1', () => ({
  useListNotebookQuery: jest.fn(),
}));

jest.mock('./notebookSearchApi', () => ({
  useSearchNotebooksQuery: jest.fn(),
}));

const mockUseGetDisplayMappingQuery = jest.mocked(useGetDisplayMappingQuery);
const mockUseListNotebookQuery = jest.mocked(useListNotebookQuery);
const mockUseSearchNotebooksQuery = jest.mocked(useSearchNotebooksQuery);

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

function setSearch(
  items: ResultItem[],
  extra: {
    isLoading?: boolean;
    error?: unknown;
    continueToken?: string;
    totalHits?: number;
    totalHitsRelation?: SearchResults['metadata']['totalHitsRelation'];
  } = {}
) {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- partial RTK Query result is all the hook reads
  mockUseSearchNotebooksQuery.mockReturnValue({
    data: extra.error
      ? undefined
      : {
          items,
          metadata: {
            continue: extra.continueToken,
            totalHits: extra.totalHits ?? items.length,
            totalHitsRelation: extra.totalHitsRelation ?? 'eq',
          },
        },
    isLoading: extra.isLoading ?? false,
    error: extra.error,
  } as unknown as ReturnType<typeof useSearchNotebooksQuery>);
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
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- partial RTK Query result is all the hook reads
  mockUseListNotebookQuery.mockReturnValue({
    data: { items, metadata: { continue: extra.continueToken } },
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

    it('reports truncation and the server-side total', () => {
      setSearch(fullPage(), { continueToken: 'next-page', totalHits: 870 });

      const { result } = setupHook();

      expect(result.current.isTruncated).toBe(true);
      expect(result.current.totalCount).toBe(870);
      expect(result.current.isTotalExact).toBe(true);
    });

    // The endpoint hands back a cursor on a short page too, whenever its total is inexact, so that
    // matches its scan never reached stay reachable. Reading that as "there is more" would tell the
    // user their complete list is a window onto something bigger.
    it('does not call a short page truncated, even when offered a continue token', () => {
      setSearch([makeHit({ name: 'nb1', title: 'One' })], {
        continueToken: 'next-page',
        totalHits: 12,
        totalHitsRelation: 'lte',
      });

      const { result } = setupHook();

      expect(result.current.isTruncated).toBe(false);
    });

    it('flags an inexact total so it is not printed as a precise number', () => {
      setSearch([makeHit({ name: 'nb1', title: 'One' })], { totalHits: 5000, totalHitsRelation: 'lte' });

      const { result } = setupHook();

      expect(result.current.isTotalExact).toBe(false);
    });

    it('is not truncated when the server returns everything it matched', () => {
      setSearch([makeHit({ name: 'nb1', title: 'One' })]);

      const { result } = setupHook();

      expect(result.current.isTruncated).toBe(false);
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
});
