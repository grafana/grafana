import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ConfirmButton } from './ConfirmButton';

describe('ConfirmButton', () => {
  it('should show confirm delete when clicked', async () => {
    const onConfirm = jest.fn();
    render(
      <ConfirmButton confirmText="Confirm delete" onConfirm={onConfirm}>
        Delete
      </ConfirmButton>
    );

    // Confirm button should not be visible before clicking the Delete button
    expect(screen.queryByRole('button', { name: 'Confirm delete' })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));

    // Confirm button should now be visible
    expect(screen.getByRole('button', { name: 'Confirm delete' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Confirm delete' }));
    expect(onConfirm).toHaveBeenCalled();

    // Confirm button should be visible if closeOnConfirm is false
    expect(screen.getByRole('button', { name: 'Confirm delete' })).toBeInTheDocument();
  });

  it('should hide confirm delete when closeOnConfirm is true', async () => {
    render(
      <ConfirmButton confirmText="Confirm delete" onConfirm={() => {}} closeOnConfirm={true}>
        Delete
      </ConfirmButton>
    );

    // Confirm button should not be visible before clicking the Delete button
    expect(screen.queryByRole('button', { name: 'Confirm delete' })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));

    // Confirm button should now be visible
    expect(screen.getByRole('button', { name: 'Confirm delete' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Confirm delete' }));

    // Confirm button should not be visible if closeOnConfirm is true
    expect(screen.queryByRole('button', { name: 'Confirm delete' })).not.toBeInTheDocument();
  });

  it('should show cancel when clicked', async () => {
    const onCancel = jest.fn();
    render(
      <ConfirmButton confirmText="Confirm delete" onCancel={onCancel} onConfirm={() => {}}>
        Delete
      </ConfirmButton>
    );

    // Cancel button should not be visible before clicking the Delete button
    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));

    // Cancel button should now be visible
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalled();

    // Cancel button should not be visible after click
    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
  });
});
