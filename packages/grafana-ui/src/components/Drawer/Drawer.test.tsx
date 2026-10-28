import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';

import { selectors } from '@grafana/e2e-selectors';

import { getPortalContainer, PortalContainer } from '../Portal/Portal';
import { Select } from '../Select/Select';
import { Toggletip } from '../Toggletip/Toggletip';
import { Tooltip } from '../Tooltip/Tooltip';

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

  it('closes on Escape after dismissing its tooltip even when document stops propagation', async () => {
    const user = userEvent.setup();
    const close = jest.fn();
    render(
      <>
        <PortalContainer />
        <Drawer title="Inspector" onClose={close}>
          <Tooltip content="Extra information">
            <button>More information</button>
          </Tooltip>
        </Drawer>
      </>
    );

    // Dashboard shortcuts stop Escape at document, before rc-drawer's window listener can receive it.
    const stopAtDocument = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
      }
    };
    document.addEventListener('keydown', stopAtDocument);
    try {
      const closeButton = screen.getByRole('button', { name: 'Close' });
      act(() => closeButton.focus());
      await screen.findByRole('tooltip', { name: 'Close' });
      await user.keyboard('{Escape}');
      await waitFor(() => expect(screen.queryByRole('tooltip', { name: 'Close' })).not.toBeInTheDocument());
      await user.keyboard('{Escape}');
      expect(close).toHaveBeenCalledTimes(1);
    } finally {
      document.removeEventListener('keydown', stopAtDocument);
    }
  });

  it('keeps focus inside the drawer while allowing the portalled select menu, then restores the trigger', async () => {
    const user = userEvent.setup();

    function Example() {
      const [selectedSource, setSelectedSource] = useState<string>();
      const [open, setOpen] = useState(false);
      return (
        <>
          <button onClick={() => setOpen(true)}>Open inspector</button>
          <PortalContainer />
          {open && (
            <Drawer title="Inspector" onClose={() => setOpen(false)}>
              <Select
                aria-label="Source"
                value={selectedSource}
                onChange={(option) => setSelectedSource(option.value)}
                options={[
                  { label: 'Data', value: 'data' },
                  { label: 'JSON', value: 'json' },
                ]}
              />
              <Toggletip closeButton={false} content={<button>Popover action</button>}>
                <button>More information</button>
              </Toggletip>
            </Drawer>
          )}
        </>
      );
    }

    render(<Example />);
    const trigger = screen.getByRole('button', { name: 'Open inspector' });
    await user.click(trigger);

    const drawer = await screen.findByRole('dialog', { name: 'Inspector' });
    await waitFor(() => expect(drawer.contains(document.activeElement)).toBe(true));

    const source = screen.getByRole('combobox', { name: 'Source' });
    await user.click(source);
    const option = await screen.findByRole('option', { name: 'JSON' });
    await user.keyboard('{ArrowDown}');
    expect(source).toHaveAttribute('aria-activedescendant', option.id);
    await user.click(option);
    expect(source).toHaveAttribute('aria-expanded', 'false');

    await user.click(screen.getByRole('button', { name: 'More information' }));
    const portalAction = await screen.findByRole('button', { name: 'Popover action' });
    await waitFor(() => expect(portalAction).toHaveFocus());
    expect(getPortalContainer()).toContainElement(portalAction);
    await user.click(portalAction);

    await user.tab();
    expect(drawer.contains(document.activeElement) || getPortalContainer().contains(document.activeElement)).toBe(true);

    await user.keyboard('{Escape}');
    await waitFor(() => expect(portalAction).not.toBeInTheDocument());
    expect(screen.getByRole('dialog', { name: 'Inspector' })).toBeInTheDocument();
    await user.tab();
    expect(drawer.contains(document.activeElement)).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(trigger).toHaveFocus());
  });
});
