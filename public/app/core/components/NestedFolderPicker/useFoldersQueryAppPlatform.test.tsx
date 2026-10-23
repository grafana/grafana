import { QueryStatus } from '@reduxjs/toolkit/query';
import { act, renderHook } from 'test/test-utils';

import { type SearchFolderChildrenPageArg } from 'app/api/clients/dashboard/v0alpha1';

import { PAGE_SIZE } from '../../../features/browse-dashboards/api/constants';

import { useFoldersQueryAppPlatform } from './useFoldersQueryAppPlatform';

const mockInitiate = jest.fn();
let mockPagesByOffset: Record<number, unknown> = {};

jest.mock('app/types/store', () => ({
  ...jest.requireActual('app/types/store'),
  useDispatch: jest.fn(() => () => ({ unsubscribe: jest.fn() })),
  // The mocked endpoint selectors ignore the store, so run the real aggregation against an empty state
  useSelector: jest.fn((selector: (state: unknown) => unknown) => selector({})),
}));

// Each selector returns the same object every time, as real RTK Query selectors do
const selectorCache = new Map<string, unknown>();
jest.mock('app/api/clients/dashboard/v0alpha1', () => ({
  dashboardAPIv0alpha1: {
    endpoints: {
      searchFolderChildrenPage: {
        initiate: (...args: unknown[]) => mockInitiate(...args),
        select: (args: SearchFolderChildrenPageArg) => () => {
          const key = JSON.stringify(args);
          if (!selectorCache.has(key)) {
            selectorCache.set(key, { originalArgs: args, ...(mockPagesByOffset[args.offset] ?? {}) });
          }
          return selectorCache.get(key);
        },
      },
    },
  },
}));

const folderHits = (prefix: string, count: number, canCreate: (index: number) => boolean = () => true) =>
  Array.from({ length: count }, (_, i) => ({
    name: `${prefix}-${i}`,
    title: `${prefix} ${String(i).padStart(2, '0')}`,
    folder: 'general',
    resource: 'folders',
    canCreate: canCreate(i),
  }));

const loadedPage = (hits: ReturnType<typeof folderHits>) => ({ status: QueryStatus.fulfilled, data: { hits } });

function renderFoldersQuery(showReadOnly = false) {
  return renderHook(() =>
    useFoldersQueryAppPlatform({ isBrowsing: true, openFolders: {}, permission: 'edit', showReadOnly })
  );
}

function loadNextPage(result: ReturnType<typeof renderFoldersQuery>['result']) {
  act(() => {
    result.current.requestNextPage(undefined);
  });
}

const uids = (result: ReturnType<typeof renderFoldersQuery>['result']) =>
  result.current.items.map((treeItem) => treeItem.item.uid);
const hasPlaceholders = (result: ReturnType<typeof renderFoldersQuery>['result']) =>
  result.current.items.some((treeItem) => treeItem.item.kind === 'ui');

describe('useFoldersQueryAppPlatform', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    selectorCache.clear();
    mockPagesByOffset = {};
  });

  it('shows the root and the virtual "Shared with me" folder before anything has loaded', () => {
    const { result } = renderFoldersQuery();

    expect(result.current.items[0].item).toMatchObject({ kind: 'folder', uid: '' });
    expect(result.current.items.find((treeItem) => treeItem.item.uid === 'sharedwithme')?.level).toBe(1);
    expect(hasPlaceholders(result)).toBe(true);
  });

  it('requests the first page with the picker permission', () => {
    const { result } = renderFoldersQuery();

    loadNextPage(result);

    expect(mockInitiate).toHaveBeenCalledWith({
      folder: 'general',
      limit: PAGE_SIZE,
      offset: 0,
      permission: 'edit',
      markReadOnly: false,
    });
  });

  it('normalizes the canonical root folder sentinel', () => {
    mockPagesByOffset = {
      0: loadedPage([
        { name: 'repo-root', title: 'Repo root', folder: 'general', resource: 'folders', canCreate: true },
      ]),
    };
    const { result } = renderFoldersQuery();

    loadNextPage(result);

    const repositoryRoot = result.current.items.find((treeItem) => treeItem.item.uid === 'repo-root');
    expect(repositoryRoot?.item).toMatchObject({ parentUID: undefined });
  });

  it('asks for read only folders to be marked, and disables them', () => {
    mockPagesByOffset = { 0: loadedPage(folderHits('folder', 2, (i) => i === 0)) };
    const { result } = renderFoldersQuery(true);

    loadNextPage(result);

    expect(mockInitiate).toHaveBeenCalledWith(expect.objectContaining({ markReadOnly: true }));
    expect(result.current.items.find((treeItem) => treeItem.item.uid === 'folder-0')).toMatchObject({
      disabled: false,
    });
    expect(result.current.items.find((treeItem) => treeItem.item.uid === 'folder-1')).toMatchObject({
      disabled: true,
      readOnly: true,
    });
    expect(result.current.items.find((treeItem) => treeItem.item.uid === 'sharedwithme')).not.toHaveProperty(
      'readOnly'
    );
  });

  it('ignores canCreate when read only folders are not shown', () => {
    mockPagesByOffset = { 0: loadedPage(folderHits('folder', 1, () => false)) };
    const { result } = renderFoldersQuery();

    loadNextPage(result);

    expect(result.current.items.find((treeItem) => treeItem.item.uid === 'folder-0')).toMatchObject({
      disabled: false,
    });
  });

  it('loads the next page after a full one, and appends it in server order', () => {
    mockPagesByOffset = {
      0: loadedPage(folderHits('first', PAGE_SIZE)),
      [PAGE_SIZE]: loadedPage([
        { name: 'last', title: 'aardvark', folder: 'general', resource: 'folders', canCreate: true },
      ]),
    };
    const { result } = renderFoldersQuery(true);

    loadNextPage(result);
    expect(hasPlaceholders(result)).toBe(true);

    loadNextPage(result);
    expect(mockInitiate).toHaveBeenLastCalledWith(expect.objectContaining({ offset: PAGE_SIZE }));
    expect(uids(result).at(-1)).toBe('last');
    expect(hasPlaceholders(result)).toBe(false);
  });

  it('stops loading after a short page', () => {
    mockPagesByOffset = { 0: loadedPage(folderHits('folder', 2)) };
    const { result } = renderFoldersQuery(true);

    loadNextPage(result);
    loadNextPage(result);

    expect(mockInitiate).toHaveBeenCalledTimes(1);
    expect(hasPlaceholders(result)).toBe(false);
  });

  it('shows the error and stops loading when a page fails', () => {
    mockPagesByOffset = { 0: { status: QueryStatus.rejected, error: { status: 403, data: { message: 'Forbidden' } } } };
    const { result } = renderFoldersQuery(true);

    loadNextPage(result);

    expect(result.current.error).toBeDefined();
    expect(hasPlaceholders(result)).toBe(false);
  });
});
