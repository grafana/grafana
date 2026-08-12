import { createMemoryHistory } from 'history';
import { render, screen } from 'test/test-utils';

import { HistoryWrapper, config, locationService, setLocationService } from '@grafana/runtime';

import { NotebookToolbar } from './NotebookToolbar';

describe('NotebookToolbar', () => {
  const originalLocationService = locationService;
  const originalAppUrl = config.appUrl;
  const originalIsSecureContext = window.isSecureContext;

  beforeEach(() => {
    // Outside a secure context ClipboardButton falls back to document.execCommand, which jsdom
    // does not implement — the copy would fail silently and never reach the clipboard stub.
    Object.assign(window, { isSecureContext: true });
    config.appUrl = 'https://host/';
  });

  afterEach(() => {
    Object.assign(window, { isSecureContext: originalIsSecureContext });
    setLocationService(originalLocationService);
    config.appUrl = originalAppUrl;
  });

  /**
   * Renders, then installs a location service that carries an orgId, so the copied link has the
   * shape it has in production.
   *
   * The order matters: the test wrapper builds its own HistoryWrapper and calls setLocationService
   * while rendering, so anything installed beforehand is discarded. notebookShareUrl reads the
   * service when the button is clicked, not at render, so setting it afterwards is enough.
   */
  function setup() {
    const rendered = render(<NotebookToolbar uid="nb1" />);

    const history = new HistoryWrapper(createMemoryHistory({ initialEntries: ['/'] }));
    history.setOrgIdGetter(() => 3);
    setLocationService(history);

    return rendered;
  }

  it('copies an absolute link to the notebook, not the in-app path', async () => {
    const { user } = setup();

    await user.click(screen.getByRole('button', { name: 'Copy link' }));

    // Both halves matter for a pasted link: the origin, or it is useless outside the app, and the
    // orgId, or it opens whichever org the reader happens to be in.
    expect(await navigator.clipboard.readText()).toBe('https://host/notebooks/nb1?orgId=3');
  });

  it('confirms the copy, so the single click does not look like it did nothing', async () => {
    const { user } = setup();

    await user.click(screen.getByRole('button', { name: 'Copy link' }));

    expect(await screen.findByText('Copied')).toBeInTheDocument();
  });
});
