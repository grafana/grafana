import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

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
});
