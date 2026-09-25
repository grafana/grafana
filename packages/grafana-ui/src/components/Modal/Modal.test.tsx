import { UNSAFE_PortalProvider } from '@react-aria/overlays';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { getPortalContainer, PortalContainer } from '../Portal/Portal';

import { Modal } from './Modal';

describe('Modal', () => {
  it('renders nothing by default or when isOpen is false', () => {
    render(<Modal title="Some Title" />);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
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
});
