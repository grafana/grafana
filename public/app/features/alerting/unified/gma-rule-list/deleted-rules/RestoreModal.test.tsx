import { render, screen, userEvent, waitFor } from 'test/test-utils';

import { makeDeletedRule } from '../mocks/handlers';

import { RestoreModal } from './RestoreModal';

const mockNavigate = jest.fn();

describe('RestoreModal', () => {
  it('shows the rule title in the confirmation', () => {
    render(
      <RestoreModal
        rule={makeDeletedRule()}
        restore={jest.fn()}
        isRestoring={false}
        navigateAfterRestore={mockNavigate}
        onDismiss={jest.fn()}
      />
    );
    expect(screen.getByText(/Deleted rule/i)).toBeInTheDocument();
  });

  it('calls onDismiss when cancelled', async () => {
    const onDismiss = jest.fn();
    render(
      <RestoreModal
        rule={makeDeletedRule()}
        restore={jest.fn()}
        isRestoring={false}
        navigateAfterRestore={mockNavigate}
        onDismiss={onDismiss}
      />
    );
    await userEvent.click(screen.getByRole('button', { name: /Cancel/i }));
    expect(onDismiss).toHaveBeenCalled();
  });

  it('calls navigateAfterRestore and onSuccess after a successful restore', async () => {
    const navigate = jest.fn();
    const onSuccess = jest.fn();
    const rule = makeDeletedRule();
    rule.metadata.name = 'my-rule-uid';

    render(
      <RestoreModal
        rule={rule}
        restore={jest.fn().mockResolvedValue({ success: true, isConflict: false })}
        isRestoring={false}
        navigateAfterRestore={navigate}
        onDismiss={jest.fn()}
        onSuccess={onSuccess}
      />
    );
    await userEvent.click(screen.getByRole('button', { name: /Restore/i }));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('my-rule-uid'));
    expect(onSuccess).toHaveBeenCalled();
  });

  it('shows the API error message inline on failure', async () => {
    render(
      <RestoreModal
        rule={makeDeletedRule()}
        restore={jest.fn().mockResolvedValue({
          success: false,
          isConflict: false,
          error: { status: 403, data: { message: 'folder not found or not writable' } },
        })}
        isRestoring={false}
        navigateAfterRestore={mockNavigate}
        onDismiss={jest.fn()}
      />
    );
    await userEvent.click(screen.getByRole('button', { name: /Restore/i }));
    expect(await screen.findByText(/folder not found or not writable/i)).toBeInTheDocument();
  });

  it('shows conflict message on conflict result', async () => {
    render(
      <RestoreModal
        rule={makeDeletedRule()}
        restore={jest.fn().mockResolvedValue({ success: false, isConflict: true })}
        isRestoring={false}
        navigateAfterRestore={mockNavigate}
        onDismiss={jest.fn()}
      />
    );
    await userEvent.click(screen.getByRole('button', { name: /Restore/i }));
    expect(await screen.findByText(/already exists/i)).toBeInTheDocument();
  });

  it('uses a custom title when provided', () => {
    render(
      <RestoreModal
        rule={makeDeletedRule()}
        restore={jest.fn()}
        isRestoring={false}
        navigateAfterRestore={mockNavigate}
        onDismiss={jest.fn()}
        title="Restore recording rule"
      />
    );
    expect(screen.getByText('Restore recording rule')).toBeInTheDocument();
  });
});
