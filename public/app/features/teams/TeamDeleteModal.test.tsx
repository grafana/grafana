import { screen } from '@testing-library/react';
import { render } from 'test/test-utils';

import { MOCK_TEAMS } from '@grafana/test-utils/unstable';

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

  it('renders a dialog with the correct title and text', async () => {
    const mockTeam = MOCK_TEAMS[0];
    render(<TeamDeleteModal {...defaultProps} />);

    expect(await screen.findByRole('dialog', { name: 'Delete' })).toBeInTheDocument();
    expect(await screen.findByText(/This action will delete the team/)).toBeInTheDocument();
    expect(await screen.findByText(`${mockTeam.spec.title}`)).toBeInTheDocument();
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

  it('shows the alert and disables the `Delete` button when ownedFolder is true', async () => {
    render(<TeamDeleteModal {...defaultProps} ownedFolder={true} />);

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(await screen.findByText('Cannot delete team')).toBeInTheDocument();

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
