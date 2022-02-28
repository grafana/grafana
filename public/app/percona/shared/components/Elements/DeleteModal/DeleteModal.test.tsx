import React from 'react';
import { DeleteModal } from './DeleteModal';
import { fireEvent, render, screen } from '@testing-library/react';

describe('DeleteModal', () => {
  it('should render modal', () => {
    render(<DeleteModal setVisible={jest.fn()} onDelete={jest.fn()} isVisible />);

    expect(screen.getByTestId('confirm-delete-modal-button')).toBeInTheDocument();
    expect(screen.getByTestId('cancel-delete-modal-button')).toBeInTheDocument();
    expect(screen.getByTestId('confirm-delete-modal-button').querySelector('i')).not.toBeInTheDocument();
    expect(screen.queryByTestId('force-checkbox-field')).not.toBeInTheDocument();
  });

  it('should render modal with custom message and title', () => {
    render(
      <DeleteModal title="Test title" message="Test message" setVisible={jest.fn()} onDelete={jest.fn()} isVisible />
    );

    expect(screen.getByText('Test title')).toBeTruthy();
    expect(screen.getByText('Test message')).toBeTruthy();
  });

  it('should not render modal when visible is set to false', () => {
    render(<DeleteModal setVisible={jest.fn()} onDelete={jest.fn()} isVisible={false} />);

    expect(screen.queryByTestId('confirm-delete-modal-button')).toBeFalsy();
    expect(screen.queryByTestId('cancel-delete-modal-button')).toBeFalsy();
  });

  it('should render spinner when loading', () => {
    render(<DeleteModal setVisible={jest.fn()} onDelete={jest.fn()} isVisible loading />);

    expect(screen.getByTestId('confirm-delete-modal-button').querySelector('i')).toBeTruthy();
  });

  it('should call setVisible on close', () => {
    const setVisible = jest.fn();
    render(<DeleteModal setVisible={setVisible} onDelete={jest.fn()} isVisible />);

    const modalBackground = screen.getByTestId('modal-background');
    fireEvent.click(modalBackground);

    expect(setVisible).toHaveBeenCalled();
  });

  it('should call onDelete on submit', () => {
    const onDelete = jest.fn();
    render(<DeleteModal setVisible={jest.fn()} onDelete={onDelete} isVisible />);

    const modalButton = screen.getByTestId('confirm-delete-modal-button');
    fireEvent.click(modalButton);

    expect(onDelete).toHaveBeenCalled();
  });

  it('should call setVisible on cancel', () => {
    const setVisible = jest.fn();
    render(<DeleteModal setVisible={setVisible} onDelete={jest.fn()} isVisible />);

    const modalButton = screen.getByTestId('cancel-delete-modal-button');
    fireEvent.click(modalButton);

    expect(setVisible).toHaveBeenCalledWith(false);
  });

  it('should render children if any', () => {
    const Dummy = () => <div data-testid="test-div">test</div>;
    render(
      <DeleteModal setVisible={jest.fn()} onDelete={jest.fn()} isVisible>
        <Dummy />
      </DeleteModal>
    );
    expect(screen.getByTestId('test-div')).toBeInTheDocument();
  });

  it('should render the force checkbox', () => {
    render(<DeleteModal setVisible={jest.fn()} onDelete={jest.fn()} isVisible showForce />);
    expect(screen.getByTestId('force-checkbox-input')).toBeInTheDocument();
  });

  it('should show the checkbox label', () => {
    render(<DeleteModal setVisible={jest.fn()} onDelete={jest.fn()} isVisible showForce forceLabel="force this" />);
    expect(screen.getByTestId('force-field-label').textContent).toBe('force this');
  });
});
