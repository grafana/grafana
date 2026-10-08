import { cleanup, render, screen, waitFor } from 'test/test-utils';

import { type Panel } from '@grafana/schema';
import { mockComboboxRect } from '@grafana/test-utils';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

import { addPanelToExistingNotebook } from '../addPanel/addPanelToNotebook';
import { useNotebookPicker } from '../addPanel/useNotebookPicker';
import { type NotebookRow } from '../list/useNotebooksList';

import { AddToNotebookFormExposedComponent } from './AddToNotebookFormExposedComponent';

jest.mock('../addPanel/useNotebookPicker', () => ({
  ...jest.requireActual('../addPanel/useNotebookPicker'),
  useNotebookPicker: jest.fn(),
}));

jest.mock('../addPanel/addPanelToNotebook', () => ({
  ...jest.requireActual('../addPanel/addPanelToNotebook'),
  addPanelToExistingNotebook: jest.fn(),
  createNotebookWithPanel: jest.fn(),
}));

// The create fields offer the library's existing tags, which reads a facet off this module. It
// calls injectEndpoints on the real client as it loads, which nothing here provides.
jest.mock('../list/notebookSearchApi', () => ({
  useLazyNotebookFieldFacetQuery: jest.fn(() => [
    jest.fn().mockResolvedValue({ data: { items: [], facets: { tags: [] } } }),
  ]),
}));

const mockUseNotebookPicker = jest.mocked(useNotebookPicker);
const addToExisting = jest.mocked(addPanelToExistingNotebook);

const panel: Panel = {
  title: 'Checkout latency',
  type: 'timeseries',
  datasource: { type: 'loki', uid: 'loki-1' },
  targets: [{ refId: 'A', expr: '{app="checkout"}' }],
};

function row(uid: string, title: string): NotebookRow {
  return {
    uid,
    title,
    tags: [],
    authorUid: 'user:1',
    authorName: 'Marcus Chen',
    created: Date.UTC(2026, 0, 1),
    updated: Date.UTC(2026, 0, 1),
  };
}

async function addToCheckoutErrorSpike(user: ReturnType<typeof render>['user']) {
  await user.click(await screen.findByRole('radio', { name: 'Existing notebook' }));
  await user.click(screen.getByRole('button', { name: 'Checkout error spike' }));
  await user.click(screen.getByRole('button', { name: 'Add to notebook' }));
}

describe('AddToNotebookFormExposedComponent', () => {
  const onClose = jest.fn();

  beforeEach(() => {
    setTestFlags({ 'dashboard.notebooks': true });
    mockComboboxRect();
    jest
      .spyOn(contextSrv, 'hasPermission')
      .mockImplementation(
        (action) => action === AccessControlAction.NotebooksCreate || action === AccessControlAction.NotebooksWrite
      );
    mockUseNotebookPicker.mockReturnValue({
      rows: [row('nb2', 'Checkout error spike')],
      isFiltered: false,
      isTruncated: false,
      isLoading: false,
      isReloading: false,
      isLoadingMore: false,
      error: undefined,
      searchQuery: '',
      setSearchQuery: jest.fn(),
      createdByMe: false,
      setCreatedByMe: jest.fn(),
      canFilterByMe: true,
      tagFilter: [],
      setTagFilter: jest.fn(),
      loadedTags: [],
      sort: 'updated',
      setSort: jest.fn(),
    } as unknown as ReturnType<typeof useNotebookPicker>);
    addToExisting.mockReset();
    addToExisting.mockResolvedValue({ uid: 'nb2', title: 'Checkout error spike' });
    onClose.mockClear();
  });

  afterEach(() => {
    // Unmount first: clearing the flag re-renders a mounted form, which logs that notebooks are off.
    cleanup();
    jest.restoreAllMocks();
    setTestFlags({});
  });

  it('stores the panel from buildPanel on the notebook the user picks', async () => {
    const buildPanel = jest.fn(() => panel);
    const { user } = render(
      <AddToNotebookFormExposedComponent
        onClose={onClose}
        buildPanel={buildPanel}
        capturedTimeRange={{ from: 'now-6h', to: 'now', timeZone: 'utc' }}
      />
    );

    await addToCheckoutErrorSpike(user);

    await waitFor(() => expect(addToExisting).toHaveBeenCalledTimes(1));
    // Built on submit, so a panel edited while the form was open is the one that lands.
    expect(buildPanel).toHaveBeenCalledTimes(1);
    const [uid, element, entryPoint, isLibraryPanel] = addToExisting.mock.calls[0];
    expect(uid).toBe('nb2');
    expect(entryPoint).toBe('plugin');
    expect(isLibraryPanel).toBe(false);
    expect(element.kind).toBe('Panel');
    if (element.kind !== 'Panel') {
      throw new Error('expected a Panel element');
    }
    expect(element.spec.title).toBe('Checkout latency');
    expect(element.spec.vizConfig.group).toBe('timeseries');
    expect(element.spec.data.spec.queries[0].spec.refId).toBe('A');
    expect(element.spec.data.spec.queries[0].spec.query.datasource).toEqual({ name: 'loki-1' });
    // A relative window starts unlocked, so the panel is not pinned to it.
    expect(element.spec.data.spec.queryOptions.timeFrom).toBeUndefined();
    expect(element.spec.data.spec.queryOptions.timeTo).toBeUndefined();
    expect(onClose).toHaveBeenCalled();
  });

  it('locks the panel to the window the plugin captured', async () => {
    const { user } = render(
      <AddToNotebookFormExposedComponent
        onClose={onClose}
        buildPanel={() => panel}
        capturedTimeRange={{ from: '2026-10-05T08:00:00.000Z', to: '2026-10-05T09:30:00.000Z', timeZone: 'utc' }}
      />
    );

    expect(screen.getByRole('checkbox', { name: /^Lock to 2026-10-05 08:00:00 to 2026-10-05 09:30:00/ })).toBeChecked();

    await addToCheckoutErrorSpike(user);

    await waitFor(() => expect(addToExisting).toHaveBeenCalledTimes(1));
    const element = addToExisting.mock.calls[0][1];
    expect(element.kind).toBe('Panel');
    if (element.kind !== 'Panel') {
      throw new Error('expected a Panel element');
    }
    expect(element.spec.data.spec.queryOptions).toMatchObject({
      timeFrom: '2026-10-05T08:00:00.000Z',
      timeTo: '2026-10-05T09:30:00.000Z',
    });
  });

});
