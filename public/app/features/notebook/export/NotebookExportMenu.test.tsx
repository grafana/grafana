import { render, screen, waitFor } from 'test/test-utils';

import { config } from '@grafana/runtime';
import { Menu } from '@grafana/ui';
import { AppNotificationList } from 'app/core/components/AppNotifications/AppNotificationList';

import { NotebookAnalytics } from '../analytics/main';
import { defaultSpec as defaultNotebookSpec, type Spec as NotebookSpec } from '../types';

import { NotebookExportMenu } from './NotebookExportMenu';
import { downloadMarkdown } from './downloadMarkdown';
import { canExportNotebookPdf, navigateToNotebookPdf, openBlankNotebookPdfTab } from './openNotebookPdf';

jest.mock('./downloadMarkdown', () => ({ downloadMarkdown: jest.fn() }));
jest.mock('./openNotebookPdf', () => ({
  canExportNotebookPdf: jest.fn(),
  openBlankNotebookPdfTab: jest.fn(),
  navigateToNotebookPdf: jest.fn(),
}));
jest.mock('../analytics/main', () => ({ NotebookAnalytics: { exported: jest.fn() } }));

const mockDownloadMarkdown = jest.mocked(downloadMarkdown);
const mockCanExportNotebookPdf = jest.mocked(canExportNotebookPdf);
const mockOpenBlankNotebookPdfTab = jest.mocked(openBlankNotebookPdfTab);
const mockNavigateToNotebookPdf = jest.mocked(navigateToNotebookPdf);
const mockExported = jest.mocked(NotebookAnalytics.exported);

function buildSpec(): NotebookSpec {
  return {
    ...defaultNotebookSpec(),
    title: 'Q2 latency regression',
    tags: [],
    // A range that differs from whatever the schema default is, so a PDF-export test asserting on
    // it actually proves the current range reached the render call, not just some coincidence.
    timeSettings: { ...defaultNotebookSpec().timeSettings, from: 'now-3h', to: 'now' },
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
  source: 'notebook_toolbar' | 'notebook_list' = 'notebook_list',
  flushPendingChanges?: () => Promise<void>
) {
  return render(
    <>
      <AppNotificationList />
      <Menu>
        <NotebookExportMenu uid="nb1" getSpec={getSpec} flushPendingChanges={flushPendingChanges} source={source} />
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
    mockCanExportNotebookPdf.mockReturnValue(false);
  });

  afterEach(() => {
    config.appUrl = originalAppUrl;
  });

  it('offers the export actions', () => {
    setup(async () => buildSpec());

    expect(screen.getByRole('menuitem', { name: 'Copy as Markdown' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Download as .md' })).toBeInTheDocument();
  });

  // The renderer has to be both configured and new enough to produce a PDF — canExportNotebookPdf
  // answers both, and this menu just asks it.
  it('hides the PDF export when the renderer cannot produce one', () => {
    setup(async () => buildSpec());

    expect(screen.queryByRole('menuitem', { name: 'Export as PDF' })).not.toBeInTheDocument();
  });

  it('offers the PDF export once the renderer can produce one, carrying the current time range', async () => {
    mockCanExportNotebookPdf.mockReturnValue(true);
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- the mock never reads anything else off it
    const tab = {} as unknown as Window;
    mockOpenBlankNotebookPdfTab.mockReturnValue(tab);
    const { user } = setup(async () => buildSpec());

    await user.click(screen.getByRole('menuitem', { name: 'Export as PDF' }));

    // Opened synchronously, within the click, before the spec (which the row menu fetches) resolves
    // — a window.open after that await could outlast the click's transient user activation.
    expect(mockOpenBlankNotebookPdfTab).toHaveBeenCalled();

    // The spec resolves before the handler navigates, so this only settles after a tick.
    await waitFor(() => {
      expect(mockNavigateToNotebookPdf).toHaveBeenCalledWith(
        tab,
        'nb1',
        expect.objectContaining({ from: 'now-3h', to: 'now' })
      );
    });
  });

  // The render route loads the saved notebook, not the scene on screen, so an edit still on
  // autosave's debounce has to be written before the headless browser goes and reads it.
  it('flushes pending changes before navigating, so the PDF holds the latest edits', async () => {
    mockCanExportNotebookPdf.mockReturnValue(true);
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- the mock reads nothing off it
    const tab = {} as unknown as Window;
    mockOpenBlankNotebookPdfTab.mockReturnValue(tab);
    const flushPendingChanges = jest.fn().mockResolvedValue(undefined);
    const { user } = setup(async () => buildSpec(), 'notebook_toolbar', flushPendingChanges);

    await user.click(screen.getByRole('menuitem', { name: 'Export as PDF' }));

    await waitFor(() => expect(mockNavigateToNotebookPdf).toHaveBeenCalled());
    expect(flushPendingChanges).toHaveBeenCalled();
    expect(flushPendingChanges.mock.invocationCallOrder[0]).toBeLessThan(
      mockNavigateToNotebookPdf.mock.invocationCallOrder[0]
    );
  });

  // Better than a PDF that is quietly missing the last few seconds of someone's typing.
  it('abandons the export when the pending changes cannot be saved', async () => {
    mockCanExportNotebookPdf.mockReturnValue(true);
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- only .close is read
    const tab = { close: jest.fn() } as unknown as Window;
    mockOpenBlankNotebookPdfTab.mockReturnValue(tab);
    const { user } = setup(
      async () => buildSpec(),
      'notebook_toolbar',
      async () => {
        throw new Error('The notebook was changed by someone else.');
      }
    );

    await user.click(screen.getByRole('menuitem', { name: 'Export as PDF' }));

    expect(await screen.findByText('Failed to export notebook')).toBeInTheDocument();
    expect(mockNavigateToNotebookPdf).not.toHaveBeenCalled();
    expect(tab.close).toHaveBeenCalled();
  });

  // A list row holds no scene and nothing to flush; the server's copy is the only one it could
  // export anyway.
  it('exports without a flush when the surface has nothing pending', async () => {
    mockCanExportNotebookPdf.mockReturnValue(true);
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- the mock reads nothing off it
    const tab = {} as unknown as Window;
    mockOpenBlankNotebookPdfTab.mockReturnValue(tab);
    const { user } = setup(async () => buildSpec());

    await user.click(screen.getByRole('menuitem', { name: 'Export as PDF' }));

    await waitFor(() => expect(mockNavigateToNotebookPdf).toHaveBeenCalled());
  });

  it('reports a blocked popup instead of doing nothing', async () => {
    mockCanExportNotebookPdf.mockReturnValue(true);
    mockOpenBlankNotebookPdfTab.mockReturnValue(null);
    const { user } = setup(async () => buildSpec());

    await user.click(screen.getByRole('menuitem', { name: 'Export as PDF' }));

    expect(await screen.findByText('Your browser blocked the PDF export tab')).toBeInTheDocument();
    expect(mockNavigateToNotebookPdf).not.toHaveBeenCalled();
  });

  it('closes the placeholder tab and reports failure when the notebook cannot be loaded', async () => {
    mockCanExportNotebookPdf.mockReturnValue(true);
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- only .close is read
    const tab = { close: jest.fn() } as unknown as Window;
    mockOpenBlankNotebookPdfTab.mockReturnValue(tab);
    const { user } = setup(async () => undefined);

    await user.click(screen.getByRole('menuitem', { name: 'Export as PDF' }));

    expect(await screen.findByText('Failed to export notebook')).toBeInTheDocument();
    expect(mockNavigateToNotebookPdf).not.toHaveBeenCalled();
    expect(tab.close).toHaveBeenCalled();
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

  // These serialize the scene in the browser and so already hold every unsaved edit. Waiting on a
  // save would only let one that failed break a copy that never needed the server at all.
  it('does not flush for the markdown exports', async () => {
    const flushPendingChanges = jest.fn().mockResolvedValue(undefined);
    const { user } = setup(async () => buildSpec(), 'notebook_toolbar', flushPendingChanges);

    await user.click(screen.getByRole('menuitem', { name: 'Download as .md' }));

    await waitFor(() => expect(mockDownloadMarkdown).toHaveBeenCalled());
    expect(flushPendingChanges).not.toHaveBeenCalled();
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
