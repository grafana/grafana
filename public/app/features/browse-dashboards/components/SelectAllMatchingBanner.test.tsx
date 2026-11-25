import { render, screen, waitFor } from 'test/test-utils';

import { type QueryResponse } from 'app/features/search/service/types';
import { configureStore } from 'app/store/configureStore';

import { MAX_SELECT_ALL_ITEMS } from '../constants';
import { type BrowseDashboardsPermissions } from '../types';

import { SelectAllMatchingBanner } from './SelectAllMatchingBanner';

const permissions: BrowseDashboardsPermissions = {
  canDeleteFolders: true,
  canEditDashboards: true,
  canEditFolders: true,
  canDeleteDashboards: true,
};

const PAGE_SIZE = 50;

function makeResult(totalRows: number) {
  const uids: string[] = [];
  const addUpTo = (count: number) => {
    while (uids.length < Math.min(count, totalRows)) {
      uids.push(`dash-${uids.length}`);
    }
  };
  addUpTo(PAGE_SIZE);

  const loadMoreItems = jest.fn(async (stopIndex: number) => {
    addUpTo(Math.ceil((stopIndex + 1) / PAGE_SIZE) * PAGE_SIZE);
  });

  const result = {
    totalRows,
    loadMoreItems,
    isItemLoaded: (index: number) => index < uids.length,
    view: {
      get length() {
        return uids.length;
      },
      get: (index: number) => ({ kind: 'dashboard', uid: uids[index] }),
    },
  };

  return { result: result as unknown as QueryResponse, loadMoreItems, uids };
}

function setup(result: QueryResponse, selectedCount = PAGE_SIZE) {
  const dashboard: Record<string, boolean> = {};
  for (let i = 0; i < selectedCount; i++) {
    dashboard[`dash-${i}`] = true;
  }

  const store = configureStore({
    browseDashboards: {
      rootItems: undefined,
      childrenByParentUID: {},
      openFolders: {},
      selectedItems: { $all: false, folder: {}, dashboard, panel: {} },
    },
  });

  return { ...render(<SelectAllMatchingBanner result={result} permissions={permissions} />, { store }), store };
}

describe('SelectAllMatchingBanner', () => {
  it('renders nothing when every result is already loaded', () => {
    const { result } = makeResult(PAGE_SIZE);
    const { container } = setup(result);

    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when a loaded row is not selected', () => {
    const { result } = makeResult(120);
    const { container } = setup(result, PAGE_SIZE - 1);

    expect(container).toBeEmptyDOMElement();
  });

  it('loads and selects every match when under the cap', async () => {
    const { result, loadMoreItems } = makeResult(120);
    const { user, store } = setup(result);

    expect(screen.getByText('50 items on this page are selected.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Select all 120 items matching this search' }));

    expect(loadMoreItems).toHaveBeenCalledWith(119);
    expect(await screen.findByText('All 120 items matching this search are selected.')).toBeInTheDocument();
    expect(Object.values(store.getState().browseDashboards.selectedItems.dashboard).filter(Boolean)).toHaveLength(120);
  });

  it('selects no more than the cap when there are more matches', async () => {
    const { result, loadMoreItems } = makeResult(MAX_SELECT_ALL_ITEMS + 80);
    const { user, store } = setup(result);

    await user.click(
      screen.getByRole('button', {
        name: `Select the first ${MAX_SELECT_ALL_ITEMS} of ${MAX_SELECT_ALL_ITEMS + 80} items`,
      })
    );

    expect(loadMoreItems).toHaveBeenCalledWith(MAX_SELECT_ALL_ITEMS - 1);
    expect(await screen.findByText(/^The first 500 of 580 items are selected/)).toBeInTheDocument();
    expect(Object.values(store.getState().browseDashboards.selectedItems.dashboard).filter(Boolean)).toHaveLength(
      MAX_SELECT_ALL_ITEMS
    );
  });

  it('does not select anything if the results change while loading', async () => {
    const { result, loadMoreItems } = makeResult(120);
    let finishLoading = () => {};
    loadMoreItems.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishLoading = resolve;
        })
    );

    const { user, store, rerender } = setup(result);
    await user.click(screen.getByRole('button', { name: 'Select all 120 items matching this search' }));

    rerender(<SelectAllMatchingBanner result={makeResult(300).result} permissions={permissions} />);
    finishLoading();

    await waitFor(() => expect(loadMoreItems).toHaveBeenCalled());
    expect(Object.keys(store.getState().browseDashboards.selectedItems.dashboard)).toHaveLength(PAGE_SIZE);
  });
});
