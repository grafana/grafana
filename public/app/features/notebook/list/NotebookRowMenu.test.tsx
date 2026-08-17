import { fireEvent, render, screen, waitFor } from 'test/test-utils';

import { config } from '@grafana/runtime';
import { useLazyGetNotebookQuery } from 'app/api/clients/dashboard/v2beta1';
import { AppNotificationList } from 'app/core/components/AppNotifications/AppNotificationList';

import { downloadMarkdown } from '../export/downloadMarkdown';
import { defaultSpec as defaultNotebookSpec } from '../types';

import { NotebookRowMenu } from './NotebookRowMenu';

jest.mock('app/api/clients/dashboard/v2beta1', () => ({ useLazyGetNotebookQuery: jest.fn() }));
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

    const { user } = render(<NotebookRowMenu uid="nb1" />);

    // The submenu opens on hover, not click.
    await user.hover(screen.getByRole('menuitem', { name: /Export/ }));

    expect(await screen.findByRole('menuitem', { name: 'Download as .md' })).toBeInTheDocument();
  });

  it('fetches this row‘s notebook and exports the spec that comes back', async () => {
    // The whole point of the row path: the table's rows carry no spec, so a broken fetch or an
    // unwrapped-wrong response would otherwise only show up in the browser.
    const trigger = setupQuery({ unwrap: async () => notebookWithOneCell() });

    const { user } = render(<NotebookRowMenu uid="nb1" />);

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

    render(<NotebookRowMenu uid="nb1" />);

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
        <NotebookRowMenu uid="nb1" />
      </>
    );

    await user.hover(screen.getByRole('menuitem', { name: /Export/ }));
    // fireEvent, not user.click: moving the pointer to the submenu item fires mouseLeave on its
    // parent, which closes the submenu before the click lands.
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Download as .md' }));

    expect(await screen.findByText('Failed to export notebook')).toBeInTheDocument();
    expect(mockDownloadMarkdown).not.toHaveBeenCalled();
  });
});
