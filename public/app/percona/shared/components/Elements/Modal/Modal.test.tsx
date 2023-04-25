import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { Modal } from './Modal';

describe('Modal window::', () => {
  it('should render modal successfully', async () => {
    const onClose = jest.fn();

    render(<Modal onClose={onClose} isVisible title="test" />);

    expect(await screen.findByTestId('modal-background')).toBeInTheDocument();
    expect(await screen.findByTestId('modal-body')).toBeInTheDocument();
    expect(await screen.findByTestId('modal-close-button')).toBeInTheDocument();
    expect(await screen.findByTestId('modal-content')).toBeInTheDocument();
  });

  it('should call onClose callback on close button click', async () => {
    const onClose = jest.fn();

    render(<Modal onClose={onClose} isVisible title="test" />);

    expect(onClose).toBeCalledTimes(0);
    fireEvent.click(await screen.findByTestId('modal-close-button'));
    expect(onClose).toBeCalledTimes(1);
  });

  it('should NOT call onClose callback on escape when closeOnEscape is NOT set', () => {
    const onClose = jest.fn();

    render(<Modal onClose={onClose} isVisible closeOnEscape={false} title="test" />);

    expect(onClose).toBeCalledTimes(0);
    const modal = screen.queryByTestId('modal-wrapper');

    expect(modal).toBeInTheDocument();
    if (modal) {
      fireEvent.keyDown(modal, { key: 'Escape', code: 'Escape' });
    }

    expect(onClose).toBeCalledTimes(0);
  });

  it('should call onClose callback on background click when closeOnClickaway is set by default', async () => {
    const onClose = jest.fn();

    render(<Modal onClose={onClose} isVisible title="test" />);

    expect(onClose).toBeCalledTimes(0);
    fireEvent.click(await screen.findByTestId('modal-background'));
    expect(onClose).toBeCalledTimes(1);
  });

  it('should NOT call onClose callback on background click when closeOnClickaway is NOT set', async () => {
    const onClose = jest.fn();

    render(<Modal onClose={onClose} isVisible closeOnClickaway={false} title="test" />);

    expect(onClose).toBeCalledTimes(0);
    userEvent.click(await screen.findByTestId('modal-background'));
    expect(onClose).toBeCalledTimes(0);
  });
});
