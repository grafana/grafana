import { cleanup, render, screen, waitFor } from 'test/test-utils';

import { type Panel } from '@grafana/schema';
import { mockComboboxRect } from '@grafana/test-utils';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

import { addToExistingNotebook } from '../addPanel/addPanelToNotebook';
import { type AppendedElement } from '../addPanel/appendPanelToNotebook';
import { useNotebookPicker } from '../addPanel/useNotebookPicker';
import { type NotebookRow } from '../list/useNotebooksList';

import { AddToNotebookFormExposedComponent } from './AddToNotebookFormExposedComponent';

jest.mock('../addPanel/useNotebookPicker', () => ({
  ...jest.requireActual('../addPanel/useNotebookPicker'),
  useNotebookPicker: jest.fn(),
}));

jest.mock('../addPanel/addPanelToNotebook', () => ({
  ...jest.requireActual('../addPanel/addPanelToNotebook'),
  addToExistingNotebook: jest.fn(),
  createNotebookWithContent: jest.fn(),
}));

// The create fields offer the library's existing tags, which reads a facet off this module. It
// calls injectEndpoints on the real client as it loads, which nothing here provides.
jest.mock('../list/notebookSearchApi', () => ({
  useLazyNotebookFieldFacetQuery: jest.fn(() => [
    jest.fn().mockResolvedValue({ data: { items: [], facets: { tags: [] } } }),
  ]),
}));

const mockUseNotebookPicker = jest.mocked(useNotebookPicker);
const addToExisting = jest.mocked(addToExistingNotebook);

/** The one panel the form handed over, as stored. */
function onlyPanel(cells: AppendedElement[]) {
  const [cell] = cells;
  if (cells.length !== 1 || cell.kind !== 'panel' || cell.panel.kind !== 'Panel') {
    throw new Error('expected a single Panel cell');
  }
  return { element: cell.panel, isLibraryPanel: cell.isLibraryPanel };
}

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
  await user.click(screen.getByRole('radio', { name: 'Checkout error spike' }));
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
    const [uid, cells, entryPoint] = addToExisting.mock.calls[0];
    const { element, isLibraryPanel } = onlyPanel(cells);
    expect(uid).toBe('nb2');
    expect(entryPoint).toBe('plugin');
    expect(isLibraryPanel).toBe(false);
    expect(element.spec.title).toBe('Checkout latency');
    expect(element.spec.vizConfig.group).toBe('timeseries');
    expect(element.spec.data.spec.queries[0].spec.refId).toBe('A');
    expect(element.spec.data.spec.queries[0].spec.query.datasource).toEqual({ name: 'loki-1' });
    // A relative window starts unlocked, so the panel is not pinned to it.
    expect(element.spec.data.spec.queryOptions.timeFrom).toBeUndefined();
    expect(element.spec.data.spec.queryOptions.timeTo).toBeUndefined();
    expect(onClose).toHaveBeenCalled();
  });

  it('attributes a single panel to the source given', async () => {
    const { user } = render(
      <AddToNotebookFormExposedComponent
        onClose={onClose}
        buildPanel={() => panel}
        capturedTimeRange={{ from: 'now-6h', to: 'now', timeZone: 'utc' }}
        source="assistant"
      />
    );

    await addToCheckoutErrorSpike(user);

    await waitFor(() => expect(addToExisting).toHaveBeenCalledTimes(1));
    expect(addToExisting.mock.calls[0][3]).toBe('assistant');
  });

  it('does not open the form for a reader who can neither create nor write', () => {
    jest
      .spyOn(contextSrv, 'hasPermission')
      .mockImplementation((action) => action === AccessControlAction.NotebooksRead);
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <AddToNotebookFormExposedComponent
        onClose={onClose}
        buildPanel={() => panel}
        capturedTimeRange={{ from: 'now-6h', to: 'now', timeZone: 'utc' }}
      />
    );

    expect(consoleError).toHaveBeenCalledWith(
      '[AddToNotebookFormExposedComponent] The user needs notebooks:create or notebooks:write to add a panel to a notebook.'
    );
    expect(screen.queryByRole('button', { name: 'Add to notebook' })).not.toBeInTheDocument();
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
    const { element } = onlyPanel(addToExisting.mock.calls[0][1]);
    expect(element.spec.data.spec.queryOptions).toMatchObject({
      timeFrom: '2026-10-05T08:00:00.000Z',
      timeTo: '2026-10-05T09:30:00.000Z',
    });
  });

  it('adds ordered cells, attributed to the source given, and reports the notebook', async () => {
    const onAdded = jest.fn();
    const { user } = render(
      <AddToNotebookFormExposedComponent
        onClose={onClose}
        source="assistant"
        onAdded={onAdded}
        cells={[
          { kind: 'markdown', text: 'Errors spiked after the deploy.' },
          { kind: 'panel', panel, capturedTimeRange: { from: 'now-6h', to: 'now', timeZone: 'utc' } },
        ]}
      />
    );

    await addToCheckoutErrorSpike(user);

    await waitFor(() => expect(addToExisting).toHaveBeenCalledTimes(1));
    const [uid, cells, entryPoint, source] = addToExisting.mock.calls[0];
    expect([uid, entryPoint, source]).toEqual(['nb2', 'plugin', 'assistant']);
    expect(cells[0]).toEqual({ kind: 'markdown', text: 'Errors spiked after the deploy.' });
    expect(cells[1].kind === 'panel' && cells[1].panel.spec.title).toBe('Checkout latency');
    expect(onAdded).toHaveBeenCalledWith({ uid: 'nb2', title: 'Checkout error spike', url: '/notebooks/nb2' });
  });

  it.each([
    ['neither content prop', {}],
    [
      'both content props',
      {
        buildPanel: () => panel,
        capturedTimeRange: { from: 'now-6h', to: 'now', timeZone: 'utc' },
        cells: [{ kind: 'markdown' as const, text: 'x' }],
      },
    ],
  ])('renders nothing when given %s', (_label, contentProps) => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { container } = render(<AddToNotebookFormExposedComponent onClose={onClose} {...contentProps} />);

    expect(container).toBeEmptyDOMElement();
    expect(error).toHaveBeenCalledWith(expect.stringContaining('exactly one of'));
  });
});
