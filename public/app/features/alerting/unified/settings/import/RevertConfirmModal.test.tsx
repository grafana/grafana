import { HttpResponse, http } from 'msw';
import { render, waitFor } from 'test/test-utils';
import { byRole, byText } from 'testing-library-selector';

import { AppNotificationList } from 'app/core/components/AppNotifications/AppNotificationList';

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
  errorTitle: byText(/failed to revert configuration/i),
  errorDetail: byText(/user is not permitted to delete this import/i),
};

// Notifications render through the app-wide list, so it has to be mounted for the toasts to appear.
function renderModal(onDismiss: () => void) {
  return render(
    <>
      <AppNotificationList />
      <RevertConfirmModal stagedConfig={stagedConfig} onDismiss={onDismiss} />
    </>
  );
}

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
    const { user } = renderModal(onDismiss);

    expect(ui.body.get()).toBeInTheDocument();
    expect(ui.reassureLive.get()).toBeInTheDocument();
    expect(ui.reassurePromoted.get()).toBeInTheDocument();
    expect(ui.reassureReimport.get()).toBeInTheDocument();

    await user.click(ui.confirm.get());

    await waitFor(() => expect(onDismiss).toHaveBeenCalled());
    expect(deletedIdentifier).toBe('config-min');
  });

  // A user scoped to a different import passes the client-side permission check and is rejected here,
  // so the modal has to stay open with the reason rather than report a revert that didn't happen.
  it('keeps the modal open and surfaces the reason when the revert is rejected', async () => {
    server.use(
      http.delete(DELETE_URL, () =>
        HttpResponse.json({ message: 'user is not permitted to delete this import' }, { status: 403 })
      )
    );

    const onDismiss = jest.fn();
    const { user } = renderModal(onDismiss);

    await user.click(ui.confirm.get());

    expect(await ui.errorTitle.find()).toBeInTheDocument();
    expect(await ui.errorDetail.find()).toBeInTheDocument();
    expect(ui.body.get()).toBeInTheDocument();
    expect(onDismiss).not.toHaveBeenCalled();
  });
});
