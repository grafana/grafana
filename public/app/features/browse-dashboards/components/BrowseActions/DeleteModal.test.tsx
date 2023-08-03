import { render as rtlRender, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { TestProvider } from 'test/helpers/TestProvider';

import { DeleteModal, Props } from './DeleteModal';

function render(...[ui, options]: Parameters<typeof rtlRender>) {
  rtlRender(<TestProvider>{ui}</TestProvider>, options);
}

describe('browse-dashboards DeleteModal', () => {
  const mockOnDismiss = jest.fn();
  const mockOnConfirm = jest.fn();

  const defaultProps: Props = {
    isOpen: true,
    onConfirm: mockOnConfirm,
    onDismiss: mockOnDismiss,
    selectedItems: {
      $all: false,
      folder: {},
      dashboard: {},
      panel: {},
    },
  };

  it('renders a dialog with the correct title', async () => {
    render(<DeleteModal {...defaultProps} />);

    expect(await screen.findByRole('dialog', { name: 'Delete' })).toBeInTheDocument();
  });

  it('displays a `Delete` button', async () => {
    render(<DeleteModal {...defaultProps} />);

    expect(await screen.findByRole('button', { name: 'Delete' })).toBeInTheDocument();
  });

  it('displays a `Cancel` button', async () => {
    render(<DeleteModal {...defaultProps} />);

    expect(await screen.findByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('only enables the `Delete` button if the confirmation text is typed', async () => {
    render(<DeleteModal {...defaultProps} />);

    const confirmationInput = await screen.findByPlaceholderText('Type "Delete" to confirm');
    await userEvent.type(confirmationInput, 'Delete');

    expect(await screen.findByRole('button', { name: 'Delete' })).toBeEnabled();
  });

  it('calls onConfirm when clicking the `Delete` button', async () => {
    render(<DeleteModal {...defaultProps} />);

    const confirmationInput = await screen.findByPlaceholderText('Type "Delete" to confirm');
    await userEvent.type(confirmationInput, 'Delete');

    await userEvent.click(await screen.findByRole('button', { name: 'Delete' }));
    expect(mockOnConfirm).toHaveBeenCalled();
  });

  it('calls onDismiss when clicking the `Cancel` button', async () => {
    render(<DeleteModal {...defaultProps} />);

    await userEvent.click(await screen.findByRole('button', { name: 'Cancel' }));
    expect(mockOnDismiss).toHaveBeenCalled();
  });

  it('calls onDismiss when clicking the X', async () => {
    render(<DeleteModal {...defaultProps} />);

    await userEvent.click(await screen.findByRole('button', { name: 'Close' }));
    expect(mockOnDismiss).toHaveBeenCalled();
  });
});
