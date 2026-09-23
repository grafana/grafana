import { fireEvent, render, screen, waitFor } from 'test/test-utils';

import { config } from '@grafana/runtime';
import { useLazyGetNotebookQuery } from 'app/api/clients/dashboard/v2beta1';
import { AppNotificationList } from 'app/core/components/AppNotifications/AppNotificationList';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

import { NotebookAnalytics } from '../analytics/main';
import { downloadMarkdown } from '../export/downloadMarkdown';
import { defaultSpec as defaultNotebookSpec } from '../types';

import { NotebookRowMenu } from './NotebookRowMenu';

jest.mock('app/api/clients/dashboard/v2beta1', () => ({ useLazyGetNotebookQuery: jest.fn() }));

// Also stubbed because the notebook header now reads its tag options from a facet on this module, and
// it calls injectEndpoints on the real client as it loads - which the mock above does not provide.
// The list page's own tests stub it for the same reason.
jest.mock('./notebookSearchApi', () => ({}));
jest.mock('../export/downloadMarkdown', () => ({ downloadMarkdown: jest.fn() }));
// Partial mock: this spies on exported and linkCopied only. Any other real call this menu makes
// keeps working.
jest.mock('../analytics/main', () => ({
  NotebookAnalytics: {
    ...jest.requireActual('../analytics/main').NotebookAnalytics,
    exported: jest.fn(),
    linkCopied: jest.fn(),
  },
}));

const mockUseLazyGetNotebookQuery = jest.mocked(useLazyGetNotebookQuery);
const mockDownloadMarkdown = jest.mocked(downloadMarkdown);
const mockExported = jest.mocked(NotebookAnalytics.exported);
const mockLinkCopied = jest.mocked(NotebookAnalytics.linkCopied);

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

  describe('Copy link', () => {
    const originalIsSecureContext = window.isSecureContext;

    beforeEach(() => {
      setupQuery({ unwrap: async () => notebookWithOneCell() });
      // Outside a secure context copyTextToClipboard falls back to document.execCommand, which
      // jsdom does not implement.
      Object.assign(window, { isSecureContext: true });
    });

    afterEach(() => {
      Object.assign(window, { isSecureContext: originalIsSecureContext });
    });

    it('copies the share link and reports the list as the source', async () => {
      // The success toast can't be the ClipboardButton inline toast this menu item replaced: it
      // anchors to the button's own DOM node, which unmounts with the Dropdown overlay as the menu
      // closes. It has to surface as an app notification instead, so render one alongside.
      const { user } = render(
        <>
          <AppNotificationList />
          <NotebookRowMenu uid="nb1" onDelete={jest.fn()} />
        </>
      );

      await user.click(screen.getByRole('menuitem', { name: 'Copy link' }));

      // Not just the toast: assert the exact URL that landed on the clipboard, so a handler that
      // copies the wrong notebook or an in-app path still fails this test.
      expect(await navigator.clipboard.readText()).toBe('https://host/notebooks/nb1');
      expect(await screen.findByText('Link copied to clipboard')).toBeInTheDocument();
      expect(mockLinkCopied).toHaveBeenCalledWith('nb1', 'notebook_list');
    });

    it('reports a failed copy rather than claiming success', async () => {
      const { user } = render(
        <>
          <AppNotificationList />
          <NotebookRowMenu uid="nb1" onDelete={jest.fn()} />
        </>
      );

      // After render: userEvent installs its own clipboard stub during setup, which would replace this.
      const writeText = jest.fn().mockRejectedValue(new Error('NotAllowedError'));
      Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true, writable: true });

      await user.click(screen.getByRole('menuitem', { name: 'Copy link' }));

      expect(await screen.findByText('Failed to copy link')).toBeInTheDocument();
      expect(screen.queryByText('Link copied to clipboard')).not.toBeInTheDocument();
      expect(mockLinkCopied).not.toHaveBeenCalled();
    });
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
    // notebook_list, not notebook_toolbar: this menu only renders inside a list row.
    expect(mockExported).toHaveBeenCalledWith('nb1', 'download', 'notebook_list');
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

    it('is hidden from a user who cannot delete notebooks', () => {
      const hasPermission = jest
        .spyOn(contextSrv, 'hasPermission')
        .mockImplementation((action) => action !== AccessControlAction.NotebooksDelete);

      render(<NotebookRowMenu uid="nb1" onDelete={jest.fn()} />);

      expect(screen.queryByRole('menuitem', { name: 'Delete' })).not.toBeInTheDocument();
      // Export is unaffected, so this is the delete permission being read and not a blanket denial.
      expect(screen.getByRole('menuitem', { name: /Export/ })).toBeInTheDocument();
      expect(hasPermission).toHaveBeenCalledWith(AccessControlAction.NotebooksDelete);
    });
  });
});
