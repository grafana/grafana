import { render, screen, userEvent, waitFor } from 'test/test-utils';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: jest.fn(),
}));

import { makeDeletedRule } from '../mocks/handlers';

import { RestoreModal } from './RestoreModal';

function makeRestorer(overrides?: Partial<{ restore: jest.Mock; isRestoring: boolean }>) {
  return { restore: jest.fn(), isRestoring: false, ...overrides };
}

describe('RestoreModal', () => {
  it('shows the rule title in the confirmation', () => {
    render(
      <RestoreModal
        kind="alert"
        rule={makeDeletedRule()}
        restorer={makeRestorer()}
        title="Restore alert rule"
        onDismiss={jest.fn()}
      />
    );
    expect(screen.getByText(/Deleted rule/i)).toBeInTheDocument();
  });

  it('calls onDismiss when cancelled', async () => {
    const onDismiss = jest.fn();
    render(
      <RestoreModal
        kind="alert"
        rule={makeDeletedRule()}
        restorer={makeRestorer()}
        title="Restore alert rule"
        onDismiss={onDismiss}
      />
    );
    await userEvent.click(screen.getByRole('button', { name: /Cancel/i }));
    expect(onDismiss).toHaveBeenCalled();
  });

  it('calls restore with the rule on confirm', async () => {
    const restore = jest.fn().mockResolvedValue({ success: true, isConflict: false });
    const rule = makeDeletedRule();
    rule.metadata.name = 'my-rule-uid';

    render(
      <RestoreModal
        kind="alert"
        rule={rule}
        restorer={makeRestorer({ restore })}
        title="Restore alert rule"
        onDismiss={jest.fn()}
      />
    );
    await userEvent.click(screen.getByRole('button', { name: /Restore/i }));
    await waitFor(() => expect(restore).toHaveBeenCalledWith(rule));
  });

  it('shows the API error message inline on failure', async () => {
    render(
      <RestoreModal
        kind="alert"
        rule={makeDeletedRule()}
        restorer={makeRestorer({
          restore: jest.fn().mockResolvedValue({
            success: false,
            isConflict: false,
            error: { status: 403, data: { message: 'folder not found or not writable' } },
          }),
        })}
        title="Restore alert rule"
        onDismiss={jest.fn()}
      />
    );
    await userEvent.click(screen.getByRole('button', { name: /Restore/i }));
    expect(await screen.findByText(/folder not found or not writable/i)).toBeInTheDocument();
  });

  it('shows conflict message on conflict result', async () => {
    render(
      <RestoreModal
        kind="alert"
        rule={makeDeletedRule()}
        restorer={makeRestorer({ restore: jest.fn().mockResolvedValue({ success: false, isConflict: true }) })}
        title="Restore alert rule"
        onDismiss={jest.fn()}
      />
    );
    await userEvent.click(screen.getByRole('button', { name: /Restore/i }));
    expect(await screen.findByText(/already exists/i)).toBeInTheDocument();
  });

  it('shows a custom title', () => {
    render(
      <RestoreModal
        kind="recording"
        rule={makeDeletedRule()}
        restorer={makeRestorer()}
        title="Restore recording rule"
        onDismiss={jest.fn()}
      />
    );
    expect(screen.getByText('Restore recording rule')).toBeInTheDocument();
  });
});
