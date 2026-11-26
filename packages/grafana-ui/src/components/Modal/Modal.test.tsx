import { UNSAFE_PortalProvider, usePreventScroll } from '@react-aria/overlays';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type ReactNode, useEffect, useState } from 'react';

import { getPortalContainer, Portal, PortalContainer } from '../Portal/Portal';

import { Modal } from './Modal';

jest.mock('@react-aria/overlays', () => {
  const actual = jest.requireActual('@react-aria/overlays');
  return {
    ...actual,
    usePreventScroll: jest.fn(),
  };
});

describe('Modal', () => {
  it('renders nothing by default or when isOpen is false', () => {
    render(<Modal title="Some Title" />);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('locks background scrolling when open and unlocks when closed', () => {
    const { rerender } = render(<Modal title="Some Title" isOpen={false} />);
    expect(usePreventScroll).toHaveBeenLastCalledWith({ isDisabled: true });

    rerender(<Modal title="Some Title" isOpen={true} />);
    expect(usePreventScroll).toHaveBeenLastCalledWith({ isDisabled: false });

    rerender(<Modal title="Some Title" isOpen={false} />);
    expect(usePreventScroll).toHaveBeenLastCalledWith({ isDisabled: true });
  });

  it('renders correct contents', () => {
    render(
      <Modal title="Some Title" isOpen>
        <div data-testid="modal-content">Content</div>
      </Modal>
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByLabelText('Some Title')).toBeInTheDocument();

    expect(screen.getByTestId('modal-content')).toBeInTheDocument();
  });

  it('forwards data attributes to the dialog element', () => {
    render(<Modal title="Some Title" isOpen data-analytics-id="settings_modal" />);

    expect(screen.getByRole('dialog', { name: 'Some Title' })).toHaveAttribute('data-analytics-id', 'settings_modal');
  });

  it('does not forward props that are not data attributes to the dialog element', () => {
    const spreadProps = { title: 'Some Title', id: 'spread-id', 'data-analytics-id': 'settings_modal' };
    render(<Modal isOpen {...spreadProps} />);

    const dialog = screen.getByRole('dialog', { name: 'Some Title' });
    expect(dialog).toHaveAttribute('data-analytics-id', 'settings_modal');
    expect(dialog).not.toHaveAttribute('id', 'spread-id');
  });

  it('pressing escape calls onDismiss correctly', async () => {
    const onDismiss = jest.fn();

    render(
      <Modal title="Some Title" isOpen onDismiss={onDismiss}>
        <div data-testid="modal-content">Content</div>
      </Modal>
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByLabelText('Some Title')).toBeInTheDocument();
    expect(screen.getByTestId('modal-content')).toBeInTheDocument();

    await userEvent.keyboard('{Escape}');

    expect(onDismiss).toHaveBeenCalled();
  });

  it('clicking backdrop calls onDismiss by default', async () => {
    const onDismiss = jest.fn();

    render(
      <Modal title="Some Title" isOpen onDismiss={onDismiss}>
        <div data-testid="modal-content">Content</div>
      </Modal>
    );

    await userEvent.click(screen.getByRole('presentation'));

    expect(onDismiss).toHaveBeenCalled();
  });

  it('closeOnBackdropClick={false} prevents dismiss on backdrop click', async () => {
    const onDismiss = jest.fn();

    render(
      <Modal title="Some Title" isOpen onDismiss={onDismiss} closeOnBackdropClick={false}>
        <div data-testid="modal-content">Content</div>
      </Modal>
    );

    await userEvent.click(screen.getByRole('presentation'));

    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('closeOnBackdropClick={false} works independently of closeOnEscape', async () => {
    const onDismiss = jest.fn();

    render(
      <Modal title="Some Title" isOpen onDismiss={onDismiss} closeOnBackdropClick={false}>
        <div data-testid="modal-content">Content</div>
      </Modal>
    );

    // Backdrop click should not dismiss
    await userEvent.click(screen.getByRole('presentation'));
    expect(onDismiss).not.toHaveBeenCalled();

    // Escape should still dismiss (closeOnEscape defaults to true)
    await userEvent.keyboard('{Escape}');
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('onClickBackdrop is called when backdrop is clicked', async () => {
    const onClickBackdrop = jest.fn();

    render(
      <Modal title="Some Title" isOpen onClickBackdrop={onClickBackdrop}>
        <div data-testid="modal-content">Content</div>
      </Modal>
    );

    await userEvent.click(screen.getByRole('presentation'));

    expect(onClickBackdrop).toHaveBeenCalled();
  });

  it('onClickBackdrop suppresses onDismiss when backdrop is clicked', async () => {
    const onDismiss = jest.fn();
    const onClickBackdrop = jest.fn();

    render(
      <Modal title="Some Title" isOpen onDismiss={onDismiss} onClickBackdrop={onClickBackdrop}>
        <div data-testid="modal-content">Content</div>
      </Modal>
    );

    await userEvent.click(screen.getByRole('presentation'));

    expect(onClickBackdrop).toHaveBeenCalled();
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('closeOnEscape={false} prevents dismiss on escape key', async () => {
    const onDismiss = jest.fn();

    render(
      <Modal title="Some Title" isOpen onDismiss={onDismiss} closeOnEscape={false}>
        <div data-testid="modal-content">Content</div>
      </Modal>
    );

    await userEvent.keyboard('{Escape}');

    expect(onDismiss).not.toHaveBeenCalled();
  });

  // Mirrors the app arrangement (see AppWrapper): UNSAFE_PortalProvider routes react-aria
  // overlays — including the modal and its backdrop — into <PortalContainer />.
  describe('with the app portal container', () => {
    function setup(onDismiss: jest.Mock) {
      const ui = (isOpen: boolean) => (
        <UNSAFE_PortalProvider getContainer={getPortalContainer}>
          <PortalContainer />
          <div data-testid="page-content">Page content</div>
          <Modal title="Some Title" isOpen={isOpen} onDismiss={onDismiss}>
            <div data-testid="modal-content">Content</div>
          </Modal>
        </UNSAFE_PortalProvider>
      );
      const { rerender } = render(ui(false));
      return { openModal: () => rerender(ui(true)) };
    }

    it('pressing an overlay inside the portal container does not dismiss', async () => {
      const onDismiss = jest.fn();
      const { openModal } = setup(onDismiss);

      const overlay = document.createElement('button');
      getPortalContainer().appendChild(overlay);
      openModal();
      await userEvent.click(overlay);

      expect(onDismiss).not.toHaveBeenCalled();
    });

    it('clicking the backdrop still dismisses', async () => {
      const onDismiss = jest.fn();
      const { openModal } = setup(onDismiss);
      openModal();

      const backdrop = screen.getByRole('presentation');
      expect(getPortalContainer().contains(backdrop)).toBe(true);
      await userEvent.click(backdrop);

      expect(onDismiss).toHaveBeenCalled();
    });

    it('pressing page content outside the portal container still dismisses', async () => {
      const onDismiss = jest.fn();
      const { openModal } = setup(onDismiss);
      openModal();

      await userEvent.click(screen.getByTestId('page-content'));

      expect(onDismiss).toHaveBeenCalled();
    });
  });

  // A Document Picture-in-Picture window (the Grafana Assistant pop-out) is another realm, as an iframe is. An app
  // can render part of its tree there through a Portal; this window's portal container is not visible from there.
  describe('inside a Portal in another window', () => {
    let iframe: HTMLIFrameElement;
    let otherDocument: Document;

    beforeEach(() => {
      iframe = document.createElement('iframe');
      document.body.appendChild(iframe);
      otherDocument = iframe.contentDocument!;
    });

    afterEach(() => {
      iframe.remove();
    });

    // Mounts its portal at once and fills it later, as Combobox does with its options.
    function LateOptions() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button onClick={() => setOpen(true)}>Show options</button>
          <Portal>
            <div role="listbox" aria-label="Options">
              {open && (
                <div role="option" aria-selected={false}>
                  First
                </div>
              )}
            </div>
          </Portal>
        </>
      );
    }

    function MountCounter({ onMount }: { onMount: () => void }) {
      useEffect(onMount, [onMount]);
      return null;
    }

    function setup(onDismiss: jest.Mock, extraContent?: ReactNode) {
      const ui = (isOpen: boolean) => (
        <UNSAFE_PortalProvider getContainer={getPortalContainer}>
          <PortalContainer />
          <Portal root={otherDocument.body}>
            <div data-testid="in-portal" />
            <Modal title="Some Title" isOpen={isOpen} onDismiss={onDismiss}>
              <div data-testid="modal-content">Content</div>
              <LateOptions />
              {extraContent}
            </Modal>
          </Portal>
        </UNSAFE_PortalProvider>
      );
      const view = render(ui(false));
      // A Portal hands its element to the portals inside it from its second render.
      view.rerender(ui(false));
      return { ...view, openModal: () => view.rerender(ui(true)) };
    }

    it('opens in that window', () => {
      const { openModal, unmount } = setup(jest.fn());
      openModal();

      expect(within(otherDocument.body).getByRole('dialog')).toHaveTextContent('Content');
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

      // Unmount before the iframe goes, or React cannot remove the portalled modal from it.
      unmount();
    });

    it('pressing an overlay in the same Portal does not dismiss', async () => {
      const onDismiss = jest.fn();
      const { openModal, unmount } = setup(onDismiss);
      openModal();

      // Portals inside the modal render into the Portal it is in, next to the modal.
      const overlay = otherDocument.createElement('button');
      within(otherDocument.body).getByTestId('in-portal').parentElement?.appendChild(overlay);
      await userEvent.click(overlay);

      expect(onDismiss).not.toHaveBeenCalled();
      unmount();
    });

    it('hides the rest of that Portal from assistive tech', () => {
      const { openModal, unmount } = setup(jest.fn());
      openModal();

      // the content the app renders in the Portal next to the modal
      expect(within(otherDocument.body).getByTestId('in-portal')).toHaveAttribute('aria-hidden', 'true');
      unmount();
    });

    it('keeps options that a portal inside the modal shows later available to assistive tech', async () => {
      const { openModal, unmount } = setup(jest.fn());
      openModal();

      await userEvent.click(within(otherDocument.body).getByRole('button', { name: 'Show options' }));

      expect(within(otherDocument.body).getByRole('option', { name: 'First' })).toBeInTheDocument();
      unmount();
    });

    it('mounts the portals inside the modal once, where they stay', () => {
      const onMount = jest.fn();
      const { openModal, unmount } = setup(
        jest.fn(),
        <Portal>
          <MountCounter onMount={onMount} />
        </Portal>
      );
      openModal();

      // moving a portal to another element remounts what it holds
      expect(onMount).toHaveBeenCalledTimes(1);
      unmount();
    });

    it('clicking the backdrop still dismisses', async () => {
      const onDismiss = jest.fn();
      const { openModal, unmount } = setup(onDismiss);
      openModal();

      // hidden from assistive tech with the rest of the Portal, as it is only presentation
      await userEvent.click(within(otherDocument.body).getByRole('presentation', { hidden: true }));

      expect(onDismiss).toHaveBeenCalled();
      unmount();
    });
  });
});
