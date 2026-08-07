import { HttpResponse, http } from 'msw';
import { act, render, waitFor } from 'test/test-utils';
import { byRole, byText } from 'testing-library-selector';

import { setupMswServer } from '../../mockApi';

import { RevertConfirmModal } from './RevertConfirmModal';

const server = setupMswServer();

const stagedConfig = {
  identifier: 'config-min',
  alertmanager_config: 'route:\n  receiver: default\nreceivers:\n  - name: default\n',
  template_files: {},
};

const DELETE_URL = '/api/convert/api/v1/alerts';

const ui = {
  body: byText(/removes the staged copy/i),
  reassureLive: byText(/live alertmanager config is not affected/i),
  reassurePromoted: byText(/already promoted stays in place/i),
  reassureReimport: byText(/import this configuration again/i),
  confirm: byRole('button', { name: /^revert$/i }),
};

describe('RevertConfirmModal', () => {
  it('shows reassuring copy and reverts the staged config on confirm', async () => {
    let deletedIdentifier: string | null = null;
    server.use(
      http.delete(DELETE_URL, ({ request }) => {
        deletedIdentifier = request.headers.get('X-Grafana-Alerting-Config-Identifier');
        return new HttpResponse(null, { status: 202 });
      })
    );

    const onDismiss = jest.fn();
    const { user } = render(<RevertConfirmModal stagedConfig={stagedConfig} onDismiss={onDismiss} />);

    expect(ui.body.get()).toBeInTheDocument();
    expect(ui.reassureLive.get()).toBeInTheDocument();
    expect(ui.reassurePromoted.get()).toBeInTheDocument();
    expect(ui.reassureReimport.get()).toBeInTheDocument();

    await user.click(ui.confirm.get());

    await waitFor(() => expect(onDismiss).toHaveBeenCalled());
    expect(deletedIdentifier).toBe('config-min');
  });

  it('reverts only once when the user submits the confirm button twice', async () => {
    let deleteCount = 0;

    server.use(
      http.delete(DELETE_URL, () => {
        deleteCount++;
        return new HttpResponse(null, { status: 202 });
      })
    );

    const onDismiss = jest.fn();
    render(<RevertConfirmModal stagedConfig={stagedConfig} onDismiss={onDismiss} />);

    // Both clicks must land before React re-renders the button as disabled; userEvent would flush
    // between them and miss the race. See useSingleFlight for why the two submits overlap at all.
    await act(async () => {
      ui.confirm.get().click();
      ui.confirm.get().click();
    });

    await waitFor(() => expect(onDismiss).toHaveBeenCalled());
    expect(deleteCount).toBe(1);
  });
});
