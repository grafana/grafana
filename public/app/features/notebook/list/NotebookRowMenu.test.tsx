import { fireEvent, render, screen, waitFor } from 'test/test-utils';

import { config } from '@grafana/runtime';
import { useLazyGetNotebookQuery } from 'app/api/clients/dashboard/v2beta1';
import { AppNotificationList } from 'app/core/components/AppNotifications/AppNotificationList';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

import { downloadMarkdown } from '../export/downloadMarkdown';
import { defaultSpec as defaultNotebookSpec } from '../types';

import { NotebookRowMenu } from './NotebookRowMenu';

jest.mock('app/api/clients/dashboard/v2beta1', () => ({ useLazyGetNotebookQuery: jest.fn() }));

// Also stubbed because the notebook header now reads its tag options from a facet on this module, and
// it calls injectEndpoints on the real client as it loads - which the mock above does not provide.
// The list page's own tests stub it for the same reason.
jest.mock('./notebookSearchApi', () => ({
  useNotebookFieldFacetQuery: jest.fn(),
}));
jest.mock('../export/downloadMarkdown', () => ({ downloadMarkdown: jest.fn() }));

const mockUseLazyGetNotebookQuery = jest.mocked(useLazyGetNotebookQuery);
const mockDownloadMarkdown = jest.mocked(downloadMarkdown);

function notebookWithOneCell() {
  return {
    metadata: { name: 'nb1' },
    spec: {
      ...defaultNotebookSpec(),
      title: 'Q2 latency regression',
      tags: [],
      elements: { md: { kind: 'Cell', spec: { content: { kind: 'Markdown', spec: { text: 'Fetched findings' } } } } },
      layout: {
        kind: 'NotebookLayout',
        spec: {
          cells: [
            { kind: 'NotebookLayoutItem', spec: { element: { kind: 'ElementReference', name: 'md' }, source: 'user' } },
          ],
        },
      },
    },
  };
}

/** Stands in for the lazy RTK Query trigger, whose result is awaited through `.unwrap()`. */
function setupQuery(result: { unwrap: () => Promise<unknown> }) {
  const trigger = jest.fn().mockReturnValue(result);
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- only the trigger is used
  mockUseLazyGetNotebookQuery.mockReturnValue([trigger] as unknown as ReturnType<typeof useLazyGetNotebookQuery>);

  return trigger;
}

describe('NotebookRowMenu', () => {
  const originalAppUrl = config.appUrl;

  beforeEach(() => {
    jest.clearAllMocks();
    config.appUrl = 'https://host/';
  });

  afterEach(() => {
    config.appUrl = originalAppUrl;
  });

  it('nests the export actions under Export', async () => {
    setupQuery({ unwrap: async () => notebookWithOneCell() });

    const { user } = render(<NotebookRowMenu uid="nb1" onDelete={jest.fn()} />);

    // The submenu opens on hover, not click.
    await user.hover(screen.getByRole('menuitem', { name: /Export/ }));

    expect(await screen.findByRole('menuitem', { name: 'Download as .md' })).toBeInTheDocument();
  });

  it('fetches this row‘s notebook and exports the spec that comes back', async () => {
    // The whole point of the row path: the table's rows carry no spec, so a broken fetch or an
    // unwrapped-wrong response would otherwise only show up in the browser.
    const trigger = setupQuery({ unwrap: async () => notebookWithOneCell() });

    const { user } = render(<NotebookRowMenu uid="nb1" onDelete={jest.fn()} />);

    await user.hover(screen.getByRole('menuitem', { name: /Export/ }));
    // fireEvent, not user.click: moving the pointer to the submenu item fires mouseLeave on its
    // parent, which closes the submenu before the click lands.
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Download as .md' }));

    await waitFor(() => {
      expect(trigger).toHaveBeenCalledWith({ name: 'nb1' });
    });
    // Content and filename both come from the fetched spec, not from the row.
    expect(mockDownloadMarkdown).toHaveBeenCalledWith(
      expect.stringContaining('Fetched findings'),
      'Q2 latency regression'
    );
  });

  it('does not fetch until an action is chosen', async () => {
    // A list of fifty rows must not fetch fifty specs just to render its menus.
    const trigger = setupQuery({ unwrap: async () => notebookWithOneCell() });

    render(<NotebookRowMenu uid="nb1" onDelete={jest.fn()} />);

    expect(trigger).not.toHaveBeenCalled();
  });

  it('reports a failed fetch rather than exporting nothing', async () => {
    setupQuery({
      unwrap: async () => {
        throw new Error('403');
      },
    });

    // The failure surfaces as an app notification rather than in this tree, so the notification list
    // is rendered alongside and the toast asserted as the user sees it.
    const { user } = render(
      <>
        <AppNotificationList />
        <NotebookRowMenu uid="nb1" onDelete={jest.fn()} />
      </>
    );

    await user.hover(screen.getByRole('menuitem', { name: /Export/ }));
    // fireEvent, not user.click: moving the pointer to the submenu item fires mouseLeave on its
    // parent, which closes the submenu before the click lands.
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Download as .md' }));

    expect(await screen.findByText('Failed to export notebook')).toBeInTheDocument();
    expect(mockDownloadMarkdown).not.toHaveBeenCalled();
  });

  describe('Delete', () => {
    beforeEach(() => {
      setupQuery({ unwrap: async () => notebookWithOneCell() });
    });

    it('asks the row to handle the delete rather than deleting anything itself', async () => {
      jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(true);
      const onDelete = jest.fn();

      const { user } = render(<NotebookRowMenu uid="nb1" onDelete={onDelete} />);
      await user.click(screen.getByRole('menuitem', { name: 'Delete' }));

      // The confirmation and the request both belong to the row: this menu lives in a Dropdown
      // overlay that unmounts as it closes, which would take a modal opened here with it.
      expect(onDelete).toHaveBeenCalledTimes(1);
    });

    it('is hidden from a user who cannot delete dashboards', () => {
      const hasPermission = jest
        .spyOn(contextSrv, 'hasPermission')
        .mockImplementation((action) => action !== AccessControlAction.DashboardsDelete);

      render(<NotebookRowMenu uid="nb1" onDelete={jest.fn()} />);

      expect(screen.queryByRole('menuitem', { name: 'Delete' })).not.toBeInTheDocument();
      // Export is unaffected, so this is the delete permission being read and not a blanket denial.
      expect(screen.getByRole('menuitem', { name: /Export/ })).toBeInTheDocument();
      expect(hasPermission).toHaveBeenCalledWith(AccessControlAction.DashboardsDelete);
    });
  });
});
