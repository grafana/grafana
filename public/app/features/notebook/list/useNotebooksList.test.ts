import { act, getWrapper, renderHook, waitFor } from 'test/test-utils';

import { type Notebook, useListNotebookQuery } from 'app/api/clients/dashboard/v2beta1';
import { useGetDisplayMappingQuery } from 'app/api/clients/iam/v0alpha1';
import { contextSrv } from 'app/core/services/context_srv';
import { defaultSpec as defaultNotebookSpec } from 'app/features/notebook/types';

import { useNotebooksList } from './useNotebooksList';

jest.mock('app/api/clients/iam/v0alpha1', () => ({
  useGetDisplayMappingQuery: jest.fn(),
}));

jest.mock('app/api/clients/dashboard/v2beta1', () => ({
  useListNotebookQuery: jest.fn(),
}));

const mockUseGetDisplayMappingQuery = jest.mocked(useGetDisplayMappingQuery);
const mockUseListNotebookQuery = jest.mocked(useListNotebookQuery);

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

function setList(items: Notebook[], extra: { isLoading?: boolean; error?: unknown } = {}) {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- partial RTK Query result is all the hook reads
  mockUseListNotebookQuery.mockReturnValue({
    data: { items },
    isLoading: extra.isLoading ?? false,
    error: extra.error,
  } as unknown as ReturnType<typeof useListNotebookQuery>);
}

function setupHook(enabled = true) {
  const wrapper = getWrapper({ renderWithRouter: false });
  return renderHook(() => useNotebooksList({ enabled }), { wrapper });
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
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- partial RTK Query result is all the hook reads
    mockUseGetDisplayMappingQuery.mockReturnValue({ data: undefined } as unknown as ReturnType<
      typeof useGetDisplayMappingQuery
    >);
    setList([]);
  });

  describe('row derivation', () => {
    it('flattens metadata and spec into rows', () => {
      setList([
        makeNotebook({
          name: 'nb1',
          title: 'Checkout error spike',
          tags: ['errors', 'checkout'],
          created: '2026-01-01T00:00:00Z',
          updated: '2026-02-01T00:00:00Z',
        }),
      ]);

      const { result } = setupHook();

      expect(result.current.rows).toEqual([
        expect.objectContaining({
          uid: 'nb1',
          title: 'Checkout error spike',
          tags: ['errors', 'checkout'],
          created: '2026-01-01T00:00:00Z',
          updated: '2026-02-01T00:00:00Z',
        }),
      ]);
    });

    it('falls back to the creation timestamp when the notebook was never updated', () => {
      setList([makeNotebook({ name: 'nb1', title: 'Never touched', created: '2026-03-04T00:00:00Z' })]);

      const { result } = setupHook();

      expect(result.current.rows[0].updated).toBe('2026-03-04T00:00:00Z');
    });

    it('sorts most recently updated first', () => {
      setList([
        makeNotebook({ name: 'older', title: 'Older', updated: '2026-01-01T00:00:00Z' }),
        makeNotebook({ name: 'newer', title: 'Newer', updated: '2026-06-01T00:00:00Z' }),
      ]);

      const { result } = setupHook();

      expect(result.current.rows.map((row) => row.uid)).toEqual(['newer', 'older']);
    });
  });

  describe('author resolution', () => {
    it('resolves createdBy identities to display names', () => {
      setList([makeNotebook({ name: 'nb1', title: 'One', createdBy: 'user:abc' })]);
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- partial RTK Query result is all the hook reads
      mockUseGetDisplayMappingQuery.mockReturnValue({
        data: { display: [{ identity: { type: 'user', name: 'abc' }, displayName: 'Marcus Chen' }] },
      } as unknown as ReturnType<typeof useGetDisplayMappingQuery>);

      const { result } = setupHook();

      expect(result.current.rows[0].authorName).toBe('Marcus Chen');
      expect(result.current.authorOptions).toEqual([{ value: 'user:abc', label: 'Marcus Chen' }]);
    });

    it('falls back to the raw identity key when the lookup returns nothing', () => {
      setList([makeNotebook({ name: 'nb1', title: 'One', createdBy: 'user:abc' })]);

      const { result } = setupHook();

      expect(result.current.rows[0].authorName).toBe('user:abc');
    });

    it('skips the display lookup when no notebook has an author', () => {
      setList([makeNotebook({ name: 'nb1', title: 'One' })]);

      setupHook();

      // skipToken is passed rather than an empty key list, which the endpoint would reject.
      expect(mockUseGetDisplayMappingQuery).toHaveBeenCalledWith(expect.anything());
      expect(mockUseGetDisplayMappingQuery).not.toHaveBeenCalledWith({ key: [] });
    });

    it('sorts the current user to the top of the author options', () => {
      const originalUser = contextSrv.user;
      contextSrv.user = { ...originalUser, uid: 'me' };
      afterEachRestore.push(() => {
        contextSrv.user = originalUser;
      });

      setList([
        makeNotebook({ name: 'nb1', title: 'One', createdBy: 'user:aaa' }),
        makeNotebook({ name: 'nb2', title: 'Two', createdBy: 'user:me' }),
      ]);

      const { result } = setupHook();

      expect(result.current.authorOptions[0].value).toBe('user:me');
    });
  });

  describe('filtering', () => {
    it('filters by title, case-insensitively, after the debounce', async () => {
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
      // totalCount stays at the unfiltered size so the page can tell "no matches" from "none exist".
      expect(result.current.totalCount).toBe(2);
    });

    it('filters by author', async () => {
      setList([
        makeNotebook({ name: 'nb1', title: 'One', createdBy: 'user:aaa' }),
        makeNotebook({ name: 'nb2', title: 'Two', createdBy: 'user:bbb' }),
      ]);

      const { result } = setupHook();

      act(() => {
        result.current.setAuthorFilter('user:bbb');
      });

      await waitFor(() => {
        expect(result.current.rows.map((row) => row.uid)).toEqual(['nb2']);
      });
    });
  });

  it('skips the list request when the feature is disabled', () => {
    setupHook(false);

    expect(mockUseListNotebookQuery).not.toHaveBeenCalledWith({});
  });
});
