import { render, screen, waitFor, within } from 'test/test-utils';

import { config } from '@grafana/runtime';
import { useDeleteNotebookMutation } from 'app/api/clients/dashboard/v2beta1';
import { AppNotificationList } from 'app/core/components/AppNotifications/AppNotificationList';
import { contextSrv } from 'app/core/services/context_srv';

import { NotebookAnalytics } from '../analytics/main';

import { NotebooksTable } from './NotebooksTable';
import { type NotebookRow } from './useNotebooksList';

jest.mock('app/api/clients/dashboard/v2beta1', () => ({
  useDeleteNotebookMutation: jest.fn(),
  // The row menu mounts the lazy get for its export submenu; nothing here exercises the fetch.
  useLazyGetNotebookQuery: () => [jest.fn()],
}));

// The row menu pulls in the notebook header's tag facet, which calls injectEndpoints on the real
// client as it loads - which the mock above does not provide.
jest.mock('./notebookSearchApi', () => ({}));
// Partial mock: this spies on linkCopied only. Every other real call this tree makes (deleted on a
// confirmed row delete, exported from the row menu's export submenu) keeps working.
jest.mock('../analytics/main', () => ({
  NotebookAnalytics: { ...jest.requireActual('../analytics/main').NotebookAnalytics, linkCopied: jest.fn() },
}));

const mockUseDeleteNotebookMutation = jest.mocked(useDeleteNotebookMutation);
const mockLinkCopied = jest.mocked(NotebookAnalytics.linkCopied);

function row(overrides: Partial<NotebookRow> = {}): NotebookRow {
  return {
    uid: 'nb1',
    title: 'Q2 latency regression',
    tags: [],
    authorUid: 'user:abc',
    authorName: 'Ada',
    created: 0,
    updated: 0,
    ...overrides,
  };
}

/** Renders the table with the props it requires, returning the tag-click spy for the cases about it. */
function renderTable(rows: NotebookRow[], onTagClick = jest.fn()) {
  return { onTagClick, ...render(<NotebooksTable notebooks={rows} onTagClick={onTagClick} />) };
}

/** Stands in for the delete mutation hook, whose result is awaited through `.unwrap()`. */
function setupDelete(unwrap: () => Promise<unknown> = async () => ({})) {
  const trigger = jest.fn().mockReturnValue({ unwrap });
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- only the trigger and isLoading are used
  mockUseDeleteNotebookMutation.mockReturnValue([trigger, { isLoading: false }] as unknown as ReturnType<
    typeof useDeleteNotebookMutation
  >);

  return trigger;
}

async function openDeleteConfirmation(user: ReturnType<typeof render>['user']) {
  await user.click(screen.getByRole('button', { name: 'More actions' }));
  await user.click(await screen.findByRole('menuitem', { name: 'Delete' }));
}

describe('NotebooksTable delete', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('names the notebook in the confirmation rather than asking in the abstract', async () => {
    setupDelete();

    const { user } = renderTable([row()]);
    await openDeleteConfirmation(user);

    expect(await screen.findByText('Are you sure you want to delete "Q2 latency regression"?')).toBeInTheDocument();
  });

  it('deletes the notebook the menu was opened from once confirmed', async () => {
    const trigger = setupDelete();

    // Two rows, so a delete that ignored which menu was opened would still look right with one.
    const { user } = renderTable([row(), row({ uid: 'nb2', title: 'Checkout errors' })]);
    // Scoped to the row rather than taken by index: the table sorts on `updated`, so the rows do not
    // necessarily appear in the order they were passed.
    const secondRow = screen.getByRole('row', { name: /Checkout errors/ });
    await user.click(within(secondRow).getByRole('button', { name: 'More actions' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }));
    await user.click(await screen.findByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(trigger).toHaveBeenCalledWith({ name: 'nb2' });
    });
  });

  it('deletes nothing when the confirmation is dismissed', async () => {
    const trigger = setupDelete();

    const { user } = renderTable([row()]);
    await openDeleteConfirmation(user);
    await user.click(await screen.findByRole('button', { name: 'Cancel' }));

    expect(trigger).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.queryByText(/Are you sure you want to delete/)).not.toBeInTheDocument();
    });
  });

  // Without this a failed delete looks like a modal that closed and did nothing, and the row is
  // still there with no explanation.
  it('reports a failed delete rather than closing silently', async () => {
    setupDelete(async () => {
      throw new Error('403');
    });

    const { user } = render(
      <>
        <AppNotificationList />
        <NotebooksTable notebooks={[row()]} onTagClick={jest.fn()} />
      </>
    );
    await openDeleteConfirmation(user);
    await user.click(await screen.findByRole('button', { name: 'Delete' }));

    expect(await screen.findByText('Failed to delete notebook')).toBeInTheDocument();
  });
});

describe('NotebooksTable tags', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(true);
    setupDelete();
  });

  // Filtering is the list's, not the table's: the row reports the tag and the caller decides.
  it('reports a clicked tag to the caller', async () => {
    const { user, onTagClick } = renderTable([row({ tags: ['latency', 'slo'] })]);

    await user.click(screen.getByRole('button', { name: 'Filter by tag slo' }));

    expect(onTagClick).toHaveBeenCalledWith('slo', expect.anything());
  });

  // A clickable Tag is a button, and "slo, button" would not say what pressing it does.
  it('says what pressing a tag will do', () => {
    renderTable([row({ tags: ['latency'] })]);

    expect(screen.getByRole('button', { name: 'Filter by tag latency' })).toBeInTheDocument();
  });
});

describe('NotebooksTable copy link', () => {
  const originalAppUrl = config.appUrl;
  const originalIsSecureContext = window.isSecureContext;

  beforeEach(() => {
    jest.clearAllMocks();
    setupDelete();
    // Outside a secure context ClipboardButton falls back to document.execCommand, which jsdom does
    // not implement.
    Object.assign(window, { isSecureContext: true });
    config.appUrl = 'https://host/';
  });

  afterEach(() => {
    Object.assign(window, { isSecureContext: originalIsSecureContext });
    config.appUrl = originalAppUrl;
  });

  it('reports the list as the source of a copied link', async () => {
    const { user } = renderTable([row()]);

    await user.click(screen.getByRole('button', { name: 'Copy link' }));

    expect(await screen.findByText('Copied')).toBeInTheDocument();
    expect(mockLinkCopied).toHaveBeenCalledWith('nb1', 'notebook_list');
  });
});
