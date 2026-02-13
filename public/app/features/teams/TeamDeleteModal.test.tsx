import { screen } from '@testing-library/react';
import { render } from 'test/test-utils';

import { TeamDeleteModal, Props } from './TeamDeleteModal';

describe('TeamDeleteModal', () => {
  const mockOnDismiss = jest.fn();
  const mockOnConfirm = jest.fn();

  const defaultProps: Props = {
    isOpen: true,
    onConfirm: mockOnConfirm,
    onDismiss: mockOnDismiss,
    teamName: 'Test Team',
    ownedFolder: false,
  };

  it('renders a dialog with the correct title', async () => {
    render(<TeamDeleteModal {...defaultProps} />);

    expect(await screen.findByRole('dialog', { name: 'Delete' })).toBeInTheDocument();
  });

  it('displays a `Cancel` and a `Delete` button', async () => {
    render(<TeamDeleteModal {...defaultProps} />);

    expect(await screen.findByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Delete' })).toBeInTheDocument();
  });

  it('enables the `Delete` button when ownedFolder is false', async () => {
    render(<TeamDeleteModal {...defaultProps} />);

    expect(await screen.findByRole('button', { name: 'Delete' })).toBeEnabled();
  });

  it('disables the `Delete` button when ownedFolder is true', async () => {
    render(<TeamDeleteModal {...defaultProps} ownedFolder={true} />);

    expect(await screen.findByRole('button', { name: 'Delete' })).toBeDisabled();
  });

  it('calls onConfirm when clicking the `Delete` button', async () => {
    const { user } = render(<TeamDeleteModal {...defaultProps} />);

    await user.click(await screen.findByRole('button', { name: 'Delete' }));
    expect(mockOnConfirm).toHaveBeenCalled();
  });

  it('calls onDismiss when clicking the `Cancel` button', async () => {
    const { user } = render(<TeamDeleteModal {...defaultProps} />);

    await user.click(await screen.findByRole('button', { name: 'Cancel' }));
    expect(mockOnDismiss).toHaveBeenCalled();
  });
});
