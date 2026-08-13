import { render, screen, waitFor } from 'test/test-utils';

import { AppEvents } from '@grafana/data';
import { config } from '@grafana/runtime';
import { Menu } from '@grafana/ui';
import { appEvents } from 'app/core/app_events';

import { defaultSpec as defaultNotebookSpec, type Spec as NotebookSpec } from '../types';

import { NotebookExportMenu } from './NotebookExportMenu';
import { openCursorPromptDeeplink } from './cursor';
import { downloadMarkdown } from './downloadMarkdown';

jest.mock('./downloadMarkdown', () => ({ downloadMarkdown: jest.fn() }));
jest.mock('./cursor', () => ({
  ...jest.requireActual('./cursor'),
  openCursorPromptDeeplink: jest.fn(),
}));

const mockDownloadMarkdown = jest.mocked(downloadMarkdown);
const mockOpenCursor = jest.mocked(openCursorPromptDeeplink);

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

function setup(getSpec: () => Promise<NotebookSpec | undefined>) {
  return render(
    <Menu>
      <NotebookExportMenu uid="nb1" getSpec={getSpec} />
    </Menu>
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

  it('offers the three export actions', () => {
    setup(async () => buildSpec());

    expect(screen.getByRole('menuitem', { name: 'Copy as Markdown' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Download as .md' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Open in Cursor' })).toBeInTheDocument();
  });

  it('copies the notebook as markdown', async () => {
    const { user } = setup(async () => buildSpec());

    await user.click(screen.getByRole('menuitem', { name: 'Copy as Markdown' }));

    const copied = await navigator.clipboard.readText();
    expect(copied).toContain('# Q2 latency regression');
    expect(copied).toContain('Findings');
  });

  it('downloads using the title from the spec, so the filename matches the document', async () => {
    const { user } = setup(async () => buildSpec());

    await user.click(screen.getByRole('menuitem', { name: 'Download as .md' }));

    // waitFor because the handler resolves the spec before acting.
    await waitFor(() => {
      expect(mockDownloadMarkdown).toHaveBeenCalledWith(expect.stringContaining('Findings'), 'Q2 latency regression');
    });
  });

  it('hands Cursor the notebook without its link line', async () => {
    const { user } = setup(async () => buildSpec());

    await user.click(screen.getByRole('menuitem', { name: 'Open in Cursor' }));

    await waitFor(() => {
      expect(mockOpenCursor).toHaveBeenCalledTimes(1);
    });
    expect(mockOpenCursor.mock.calls[0][0]).not.toContain('Open in Grafana');
  });

  it('reports a failed copy instead of claiming success', async () => {
    // The clipboard write settles after the spec loads, so its outcome is the only thing that says
    // whether anything reached the clipboard. Toasting success without it is a lie the user acts on.
    const emit = jest.spyOn(appEvents, 'emit');
    const { user } = setup(async () => buildSpec());

    // After render: userEvent installs its own clipboard stub during setup, which would replace this.
    const writeText = jest.fn().mockRejectedValue(new Error('NotAllowedError'));
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true, writable: true });

    await user.click(screen.getByRole('menuitem', { name: 'Copy as Markdown' }));

    await waitFor(() => {
      expect(emit).toHaveBeenCalledWith(AppEvents.alertError, ['Failed to export notebook']);
    });
    expect(emit).not.toHaveBeenCalledWith(AppEvents.alertSuccess, expect.anything());
  });

  it('reports a failure instead of doing nothing', async () => {
    // A row-level export fetches, so this is a real path: the notebook may be gone or forbidden.
    const emit = jest.spyOn(appEvents, 'emit');
    const { user } = setup(async () => {
      throw new Error('403');
    });

    await user.click(screen.getByRole('menuitem', { name: 'Copy as Markdown' }));

    await waitFor(() => {
      expect(emit).toHaveBeenCalledWith(AppEvents.alertError, ['Failed to export notebook']);
    });
    expect(mockDownloadMarkdown).not.toHaveBeenCalled();
  });

  it('treats a missing notebook as a failure too', async () => {
    const emit = jest.spyOn(appEvents, 'emit');
    const { user } = setup(async () => undefined);

    await user.click(screen.getByRole('menuitem', { name: 'Download as .md' }));

    expect(emit).toHaveBeenCalledWith(AppEvents.alertError, ['Failed to export notebook']);
    expect(mockDownloadMarkdown).not.toHaveBeenCalled();
  });
});
