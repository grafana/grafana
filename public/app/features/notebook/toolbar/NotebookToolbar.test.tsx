import { render, screen } from 'test/test-utils';

import { config } from '@grafana/runtime';

import { NotebookToolbar } from './NotebookToolbar';

describe('NotebookToolbar', () => {
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
    config.appUrl = originalAppUrl;
  });

  it('copies an absolute link to the notebook, not the in-app path', async () => {
    const { user } = render(<NotebookToolbar uid="nb1" />);

    await user.click(screen.getByRole('button', { name: 'Copy link' }));

    // The origin is the point: a copied '/notebooks/nb1' would be useless pasted into an email.
    // notebookShareUrl's sub-path and orgId handling is covered by urls.test.ts.
    expect(await navigator.clipboard.readText()).toBe('https://host/notebooks/nb1');
  });

  it('confirms the copy, so the single click does not look like it did nothing', async () => {
    const { user } = render(<NotebookToolbar uid="nb1" />);

    await user.click(screen.getByRole('button', { name: 'Copy link' }));

    expect(await screen.findByText('Copied')).toBeInTheDocument();
  });
});
