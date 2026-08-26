import { render, screen, waitFor, within } from 'test/test-utils';

import { useDeleteNotebookMutation } from 'app/api/clients/dashboard/v2beta1';
import { AppNotificationList } from 'app/core/components/AppNotifications/AppNotificationList';
import { contextSrv } from 'app/core/services/context_srv';

import { NotebooksTable } from './NotebooksTable';
import { type NotebookRow } from './useNotebooksList';

jest.mock('app/api/clients/dashboard/v2beta1', () => ({
  useDeleteNotebookMutation: jest.fn(),
  // The row menu mounts the lazy get for its export submenu; nothing here exercises the fetch.
  useLazyGetNotebookQuery: () => [jest.fn()],
}));

// The row menu pulls in the notebook header's tag facet, which calls injectEndpoints on the real
// client as it loads - which the mock above does not provide.
jest.mock('./notebookSearchApi', () => ({
  useNotebookFieldFacetQuery: jest.fn(),
}));

const mockUseDeleteNotebookMutation = jest.mocked(useDeleteNotebookMutation);

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

    const { user } = render(<NotebooksTable notebooks={[row()]} />);
    await openDeleteConfirmation(user);

    expect(await screen.findByText('Are you sure you want to delete "Q2 latency regression"?')).toBeInTheDocument();
  });

  it('deletes the notebook the menu was opened from once confirmed', async () => {
    const trigger = setupDelete();

    // Two rows, so a delete that ignored which menu was opened would still look right with one.
    const { user } = render(<NotebooksTable notebooks={[row(), row({ uid: 'nb2', title: 'Checkout errors' })]} />);
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

    const { user } = render(<NotebooksTable notebooks={[row()]} />);
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
        <NotebooksTable notebooks={[row()]} />
      </>
    );
    await openDeleteConfirmation(user);
    await user.click(await screen.findByRole('button', { name: 'Delete' }));

    expect(await screen.findByText('Failed to delete notebook')).toBeInTheDocument();
  });
});
