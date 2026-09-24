import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef, useState } from 'react';

import { selectors } from '@grafana/e2e-selectors';

import { Drawer } from './Drawer';
import { DrawerFocusScope } from './DrawerFocusScope';

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

  it.each(['default', 'explicit', 'disabled'])('honors %s return-focus behavior', async (mode) => {
    const target = createRef<HTMLButtonElement>();
    function Example() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button onClick={() => setOpen(true)}>Open</button>
          <button ref={target}>Return target</button>
          {open && (
            <Drawer
              title="Drawer"
              onClose={() => setOpen(false)}
              returnFocus={mode === 'explicit' ? target : mode === 'disabled' ? false : undefined}
            >
              <textarea aria-label="Message" />
            </Drawer>
          )}
        </>
      );
    }
    const user = userEvent.setup();
    render(<Example />);
    const opener = screen.getByRole('button', { name: 'Open' });
    await user.click(opener);
    const close = screen.getByTestId(selectors.components.Drawer.General.close);
    await waitFor(() => expect(close).toHaveFocus());
    await user.click(close);
    await waitFor(() =>
      expect(mode === 'explicit' ? target.current : mode === 'disabled' ? document.body : opener).toHaveFocus()
    );
  });

  it('restores nested drawer focus inside the scope before returning to the original opener', async () => {
    function Example() {
      const [open, setOpen] = useState(false);
      const [nested, setNested] = useState(false);
      return (
        <>
          <button onClick={() => setOpen(true)}>Open</button>
          {open && (
            <DrawerFocusScope>
              <Drawer title="Outer" onClose={() => setOpen(false)}>
                <button onClick={() => setNested(true)}>Open nested</button>
                {nested && (
                  <Drawer title="Nested" onClose={() => setNested(false)}>
                    <textarea aria-label="Nested message" />
                  </Drawer>
                )}
              </Drawer>
            </DrawerFocusScope>
          )}
        </>
      );
    }
    const user = userEvent.setup();
    render(<Example />);
    const opener = screen.getByRole('button', { name: 'Open' });
    await user.click(opener);
    const nestedOpener = screen.getByRole('button', { name: 'Open nested' });
    await user.click(nestedOpener);
    const nestedClose = within(screen.getByRole('dialog', { name: 'Nested' })).getByTestId(
      selectors.components.Drawer.General.close
    );
    await waitFor(() => expect(nestedClose).toHaveFocus());
    await user.click(nestedClose);
    await waitFor(() => expect(nestedOpener).toHaveFocus());
    await user.click(
      within(screen.getByRole('dialog', { name: 'Outer' })).getByTestId(selectors.components.Drawer.General.close)
    );
    await waitFor(() => expect(opener).toHaveFocus());
  });
});
