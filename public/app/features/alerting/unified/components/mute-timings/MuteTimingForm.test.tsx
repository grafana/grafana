import { render, screen } from 'test/test-utils';

import { setupMswServer } from 'app/features/alerting/unified/mockApi';
import { grantUserPermissions } from 'app/features/alerting/unified/mocks';
import { AlertmanagerProvider } from 'app/features/alerting/unified/state/AlertmanagerContext';
import { GRAFANA_RULES_SOURCE_NAME } from 'app/features/alerting/unified/utils/datasource';
import { AccessControlAction } from 'app/types/accessControl';

import MuteTimingForm from './MuteTimingForm';
import { muteTimeInterval } from './mocks';

const renderWithProvider = (provenance?: string, editMode = false) => {
  return render(
    <AlertmanagerProvider accessType={'notification'} alertmanagerSourceName={GRAFANA_RULES_SOURCE_NAME}>
      <MuteTimingForm
        muteTiming={{ id: 'mock-id', ...muteTimeInterval }}
        provenance={provenance}
        editMode={editMode}
        loading={false}
        showError={false}
      />
    </AlertmanagerProvider>
  );
};

setupMswServer();

describe('MuteTimingForm', () => {
  beforeEach(() => {
    grantUserPermissions([
      AccessControlAction.AlertingNotificationsRead,
      AccessControlAction.AlertingNotificationsWrite,
    ]);
  });

  it('should not show any alert when provenance is none', async () => {
    renderWithProvider('none');

    expect(screen.queryByText(/imported and cannot be edited/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/provisioned/i)).not.toBeInTheDocument();
  });

  it('should not show any alert when provenance is undefined', async () => {
    renderWithProvider(undefined);

    expect(screen.queryByText(/imported and cannot be edited/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/provisioned/i)).not.toBeInTheDocument();
  });

  it('should show imported alert when provenance is prometheus_convert', async () => {
    renderWithProvider('prometheus_convert');

    expect(
      await screen.findByText(/This time interval was imported and cannot be edited through the UI/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/This time interval was imported from an external Alertmanager and is currently read-only/i)
    ).toBeInTheDocument();
  });

  it('should show provisioning alert when provenance is file', async () => {
    renderWithProvider('file');

    expect(await screen.findByText(/This time interval cannot be edited through the UI/i)).toBeInTheDocument();
    expect(
      screen.getByText(/This time interval has been provisioned, that means it was created by config/i)
    ).toBeInTheDocument();
  });

  it('should show provisioning alert for other provenance types', async () => {
    renderWithProvider('api');

    expect(await screen.findByText(/This time interval cannot be edited through the UI/i)).toBeInTheDocument();
  });

  it('should disable form when provenance is prometheus_convert', async () => {
    renderWithProvider('prometheus_convert', true);

    const nameInput = await screen.findByTestId('mute-timing-name');
    expect(nameInput).toBeDisabled();
  });

  it('should disable form when provenance is file', async () => {
    renderWithProvider('file', true);

    const nameInput = await screen.findByTestId('mute-timing-name');
    expect(nameInput).toBeDisabled();
  });

  it('should enable form when provenance is none', async () => {
    renderWithProvider('none', true);

    const nameInput = await screen.findByTestId('mute-timing-name');
    expect(nameInput).toBeEnabled();
  });

  it('should enable form when provenance is undefined', async () => {
    renderWithProvider(undefined, true);

    const nameInput = await screen.findByTestId('mute-timing-name');
    expect(nameInput).toBeEnabled();
  });
});
