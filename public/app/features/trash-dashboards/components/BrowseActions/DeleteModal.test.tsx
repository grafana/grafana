import { render as rtlRender, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { TestProvider } from 'test/helpers/TestProvider';

import { DeleteModal, Props } from './DeleteModal';

function render(...[ui, options]: Parameters<typeof rtlRender>) {
  rtlRender(<TestProvider>{ui}</TestProvider>, options);
}

describe('trash-dashboards DeleteModal', () => {
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
    isLoading: false,
  };

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
});
