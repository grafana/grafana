import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';

import { selectors } from '@grafana/e2e-selectors';

import { DRAWER_INSIDE_ATTRIBUTE, Drawer } from './Drawer';

describe('Drawer', () => {
  // Drawer.tsx passes getContainer={'.main-view'} to RcDrawer, which tells it
  // to portal its content into the element matching that CSS selector.
  // In the real app, .main-view exists in the page shell. In tests, jsdom
  // starts with an empty body, so we create it manually — otherwise RcDrawer
  // has nowhere to render and the Drawer never appears in the DOM.
  let mainView: HTMLDivElement;

  beforeEach(() => {
    mainView = document.createElement('div');
    mainView.classList.add('main-view');
    document.body.appendChild(mainView);
  });

  afterEach(() => {
    document.body.removeChild(mainView);
  });

  it('renders with string title and children', () => {
    render(
      <Drawer title="Test Title" onClose={() => {}}>
        <div>Drawer content</div>
      </Drawer>
    );

    expect(screen.getByText('Test Title')).toBeInTheDocument();
    expect(screen.getByText('Drawer content')).toBeInTheDocument();
  });

  it('has an accessible name from the visible heading when title is a string', () => {
    render(
      <Drawer title="Share" onClose={() => {}}>
        <div>Content</div>
      </Drawer>
    );

    const heading = screen.getByRole('heading', { name: 'Share' });
    expect(heading).toHaveAttribute('id');

    const drawer = screen.getByRole('dialog');
    expect(drawer).toHaveAttribute('aria-labelledby', heading.getAttribute('id'));
    // aria-label kept for e2e selector compatibility
    expect(drawer).toHaveAttribute('aria-label', selectors.components.Drawer.General.title('Share'));
  });

  it('has an accessible name from a custom title element', () => {
    render(
      <Drawer title={<h3>Custom Title</h3>} onClose={() => {}}>
        <div>Content</div>
      </Drawer>
    );

    const heading = screen.getByText('Custom Title');
    const titleWrapper = heading.closest('[id]');
    expect(titleWrapper).toHaveAttribute('id');

    const drawer = screen.getByRole('dialog');
    expect(drawer).toHaveAttribute('aria-labelledby', titleWrapper?.getAttribute('id'));
    // no aria-label for non-string titles
    expect(drawer).not.toHaveAttribute('aria-label');
  });

  it('initially focuses the close button', async () => {
    render(
      <Drawer title="Inspect" onClose={() => {}}>
        <button>First action</button>
      </Drawer>
    );

    await waitFor(() => expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus());
  });

  it('wraps Tab and Shift+Tab within the drawer', async () => {
    const user = userEvent.setup();
    render(
      <>
        <button>Outside action</button>
        <Drawer title="Inspect" onClose={() => {}}>
          <button>First action</button>
          <button>Last action</button>
        </Drawer>
      </>
    );

    const close = screen.getByRole('button', { name: 'Close' });
    const first = screen.getByRole('button', { name: 'First action' });
    const last = screen.getByRole('button', { name: 'Last action' });
    await waitFor(() => expect(close).toHaveFocus());

    // The default scrollable content has its own tab stop for keyboard scrolling.
    await user.tab();
    expect(first.closest('[tabindex="0"]')).toHaveFocus();
    await user.tab();
    expect(first).toHaveFocus();
    await user.tab();
    expect(last).toHaveFocus();
    await user.tab();
    await waitFor(() => expect(close).toHaveFocus());
    await user.tab({ shift: true });
    await waitFor(() => expect(last).toHaveFocus());
  });

  it('returns focus to the opener after closing', async () => {
    const user = userEvent.setup();
    function DrawerWithTrigger() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button onClick={() => setOpen(true)}>Open drawer</button>
          {open && (
            <Drawer title="Inspect" onClose={() => setOpen(false)}>
              <button>Drawer action</button>
            </Drawer>
          )}
        </>
      );
    }
    render(<DrawerWithTrigger />);

    const opener = screen.getByRole('button', { name: 'Open drawer' });
    await user.click(opener);
    const close = await screen.findByRole('button', { name: 'Close' });
    await waitFor(() => expect(close).toHaveFocus());
    await user.click(close);

    await waitFor(() => expect(opener).toHaveFocus());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('keeps elements marked as inside reachable while open, and hides the rest of the page', async () => {
    // Without the portal container, getPortalContainer() falls back to document.body and so treats the whole page as inside.
    const portalContainer = document.createElement('div');
    portalContainer.id = 'grafana-portal-container';
    const page = document.createElement('div');
    const floating = document.createElement('div');
    floating.setAttribute(DRAWER_INSIDE_ATTRIBUTE, '');
    document.body.append(portalContainer, page, floating);

    render(
      <Drawer title="Inspect" onClose={() => {}}>
        <div>Content</div>
      </Drawer>
    );

    await waitFor(() => expect(page).toHaveAttribute('aria-hidden', 'true'));
    expect(floating).not.toHaveAttribute('aria-hidden');

    portalContainer.remove();
    page.remove();
    floating.remove();
  });
});
