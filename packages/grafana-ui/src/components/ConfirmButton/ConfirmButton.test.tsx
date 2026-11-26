import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { Button } from '../Button/Button';

import { ConfirmButton } from './ConfirmButton';
import { DeleteButton } from './DeleteButton';

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

  it('forwards data attributes to the button that opens the confirmation', () => {
    render(
      <ConfirmButton onConfirm={() => {}} data-analytics-id="settings_value_edited">
        Edit
      </ConfirmButton>
    );

    expect(screen.getByRole('button', { name: 'Edit' })).toHaveAttribute('data-analytics-id', 'settings_value_edited');
  });

  it('forwards data attributes to a custom trigger element', () => {
    render(
      <ConfirmButton onConfirm={() => {}} data-analytics-id="settings_value_edited">
        <Button>Edit</Button>
      </ConfirmButton>
    );

    expect(screen.getByRole('button', { name: 'Edit' })).toHaveAttribute('data-analytics-id', 'settings_value_edited');
  });

  it('does not forward non-data props that arrive through an object spread', () => {
    const spreadProps = { 'aria-label': 'Overridden', 'data-analytics-id': 'settings_value_edited' };

    render(
      <ConfirmButton onConfirm={() => {}} {...spreadProps}>
        <Button aria-label="Edit value">Edit</Button>
      </ConfirmButton>
    );

    const button = screen.getByRole('button', { name: 'Edit value' });
    expect(button).toHaveAttribute('data-analytics-id', 'settings_value_edited');
    expect(button).toHaveAttribute('aria-label', 'Edit value');
  });

  it('forwards data attributes through DeleteButton to its delete button', () => {
    render(<DeleteButton onConfirm={() => {}} aria-label="Delete row" data-analytics-id="row_deleted" />);

    expect(screen.getByRole('button', { name: 'Delete row' })).toHaveAttribute('data-analytics-id', 'row_deleted');
  });
});
