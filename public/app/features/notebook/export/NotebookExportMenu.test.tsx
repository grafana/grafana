import { render, screen, waitFor } from 'test/test-utils';

import { config } from '@grafana/runtime';
import { Menu } from '@grafana/ui';
import { AppNotificationList } from 'app/core/components/AppNotifications/AppNotificationList';

import { NotebookAnalytics } from '../analytics/main';
import { defaultSpec as defaultNotebookSpec, type Spec as NotebookSpec } from '../types';

import { NotebookExportMenu } from './NotebookExportMenu';
import { downloadMarkdown } from './downloadMarkdown';

jest.mock('./downloadMarkdown', () => ({ downloadMarkdown: jest.fn() }));
jest.mock('../analytics/main', () => ({ NotebookAnalytics: { exported: jest.fn() } }));

const mockDownloadMarkdown = jest.mocked(downloadMarkdown);
const mockExported = jest.mocked(NotebookAnalytics.exported);

function buildSpec(): NotebookSpec {
  return {
    ...defaultNotebookSpec(),
    title: 'Q2 latency regression',
    tags: [],
    elements: { md: { kind: 'Cell', spec: { content: { kind: 'Markdown', spec: { text: 'Findings' } } } } },
    layout: {
      kind: 'NotebookLayout',
      spec: {
        cells: [
          { kind: 'NotebookLayoutItem', spec: { element: { kind: 'ElementReference', name: 'md' }, source: 'user' } },
        ],
      },
    },
  };
}

// AppNotificationList is rendered alongside so the toasts can be asserted as the user sees them,
// rather than by spying on the dispatch that produces them.
function setup(
  getSpec: () => Promise<NotebookSpec | undefined>,
  source: 'notebook_toolbar' | 'notebook_list' = 'notebook_list'
) {
  return render(
    <>
      <AppNotificationList />
      <Menu>
        <NotebookExportMenu uid="nb1" getSpec={getSpec} source={source} />
      </Menu>
    </>
  );
}

describe('NotebookExportMenu', () => {
  const originalAppUrl = config.appUrl;
  const originalClipboard = navigator.clipboard;

  beforeEach(() => {
    jest.clearAllMocks();
    Object.assign(window, { isSecureContext: true });
    // One test swaps in a failing clipboard; put the real one back so the others are unaffected.
    Object.defineProperty(navigator, 'clipboard', {
      value: originalClipboard,
      configurable: true,
      writable: true,
    });
    // notebookShareUrl resolves the share link against config.appUrl; jest leaves it unset, and
    // `new URL(path, undefined)` throws, which the menu would report as an export failure.
    config.appUrl = 'https://host/';
  });

  afterEach(() => {
    config.appUrl = originalAppUrl;
  });

  it('offers the export actions', () => {
    setup(async () => buildSpec());

    expect(screen.getByRole('menuitem', { name: 'Copy as Markdown' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Download as .md' })).toBeInTheDocument();
  });

  it('copies the notebook as markdown', async () => {
    const { user } = setup(async () => buildSpec(), 'notebook_toolbar');

    await user.click(screen.getByRole('menuitem', { name: 'Copy as Markdown' }));

    const copied = await navigator.clipboard.readText();
    expect(copied).toContain('# Q2 latency regression');
    expect(copied).toContain('Findings');
    expect(mockExported).toHaveBeenCalledWith('nb1', 'clipboard', 'notebook_toolbar');
  });

  it('downloads using the title from the spec, so the filename matches the document', async () => {
    const { user } = setup(async () => buildSpec());

    await user.click(screen.getByRole('menuitem', { name: 'Download as .md' }));

    // waitFor because the handler resolves the spec before acting.
    await waitFor(() => {
      expect(mockDownloadMarkdown).toHaveBeenCalledWith(expect.stringContaining('Findings'), 'Q2 latency regression');
    });
    expect(mockExported).toHaveBeenCalledWith('nb1', 'download', 'notebook_list');
  });

  it('reports a failed copy instead of claiming success', async () => {
    // The clipboard write settles after the spec loads, so its outcome is the only thing that says
    // whether anything reached the clipboard. Toasting success without it is a lie the user acts on.
    const { user } = setup(async () => buildSpec());

    // After render: userEvent installs its own clipboard stub during setup, which would replace this.
    const writeText = jest.fn().mockRejectedValue(new Error('NotAllowedError'));
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true, writable: true });

    await user.click(screen.getByRole('menuitem', { name: 'Copy as Markdown' }));

    expect(await screen.findByText('Failed to export notebook')).toBeInTheDocument();
    expect(screen.queryByText('Notebook copied as Markdown')).not.toBeInTheDocument();
    expect(mockExported).not.toHaveBeenCalled();
  });

  it('reports a failure instead of doing nothing', async () => {
    // A row-level export fetches, so this is a real path: the notebook may be gone or forbidden.
    const { user } = setup(async () => {
      throw new Error('403');
    });

    await user.click(screen.getByRole('menuitem', { name: 'Copy as Markdown' }));

    expect(await screen.findByText('Failed to export notebook')).toBeInTheDocument();
    expect(mockDownloadMarkdown).not.toHaveBeenCalled();
    expect(mockExported).not.toHaveBeenCalled();
  });

  it('treats a missing notebook as a failure too', async () => {
    const { user } = setup(async () => undefined);

    await user.click(screen.getByRole('menuitem', { name: 'Download as .md' }));

    expect(await screen.findByText('Failed to export notebook')).toBeInTheDocument();
    expect(mockDownloadMarkdown).not.toHaveBeenCalled();
    expect(mockExported).not.toHaveBeenCalled();
  });
});
