import { render, screen, userEvent } from 'test/test-utils';

import { setupMswServer } from 'app/features/alerting/unified/mockApi';
import { grantUserPermissions } from 'app/features/alerting/unified/mocks';
import { setTimeIntervalsList } from 'app/features/alerting/unified/mocks/server/configure';
import { AlertmanagerProvider } from 'app/features/alerting/unified/state/AlertmanagerContext';
import { GRAFANA_RULES_SOURCE_NAME } from 'app/features/alerting/unified/utils/datasource';
import { AccessControlAction } from 'app/types/accessControl';

import MuteTimingsSelector from './MuteTimingsSelector';

const renderWithProvider = (alertManagerSource = GRAFANA_RULES_SOURCE_NAME) => {
  return render(
    <AlertmanagerProvider accessType={'notification'} alertmanagerSourceName={alertManagerSource}>
      <MuteTimingsSelector
        alertmanager={alertManagerSource}
        selectProps={{
          onChange: () => {},
        }}
      />
    </AlertmanagerProvider>
  );
};

setupMswServer();

describe('MuteTimingsSelector', () => {
  beforeEach(() => {
    grantUserPermissions([
      AccessControlAction.AlertingNotificationsRead,
      AccessControlAction.AlertingNotificationsWrite,
    ]);
  });

  it('should show all non-imported time intervals', async () => {
    const user = userEvent.setup();
    setTimeIntervalsList([
      { name: 'regular-interval', provenance: 'none' },
      { name: 'file-provisioned', provenance: 'file' },
      { name: 'another-regular', provenance: 'none' },
    ]);

    renderWithProvider();

    // Click to open the dropdown
    const selector = await screen.findByRole('combobox', { name: /time intervals/i });
    await user.click(selector);

    // All non-imported intervals should be visible
    expect(await screen.findByText('regular-interval')).toBeInTheDocument();
    expect(screen.getByText('file-provisioned')).toBeInTheDocument();
    expect(screen.getByText('another-regular')).toBeInTheDocument();
  });

  it('should filter out imported time intervals (provenance: prometheus_convert)', async () => {
    const user = userEvent.setup();
    setTimeIntervalsList([
      { name: 'regular-interval', provenance: 'none' },
      { name: 'imported-interval', provenance: 'prometheus_convert' },
      { name: 'file-provisioned', provenance: 'file' },
    ]);

    renderWithProvider();

    // Click to open the dropdown
    const selector = await screen.findByRole('combobox', { name: /time intervals/i });
    await user.click(selector);

    // Regular and file-provisioned should be visible
    expect(await screen.findByText('regular-interval')).toBeInTheDocument();
    expect(screen.getByText('file-provisioned')).toBeInTheDocument();

    // Imported interval should NOT be in the list
    expect(screen.queryByText('imported-interval')).not.toBeInTheDocument();
  });

  it('should show only non-imported intervals when all types are present', async () => {
    const user = userEvent.setup();
    setTimeIntervalsList([
      { name: 'normal-1', provenance: 'none' },
      { name: 'imported-1', provenance: 'prometheus_convert' },
      { name: 'normal-2', provenance: 'none' },
      { name: 'imported-2', provenance: 'prometheus_convert' },
      { name: 'file-1', provenance: 'file' },
    ]);

    renderWithProvider();

    // Click to open the dropdown
    const selector = await screen.findByRole('combobox', { name: /time intervals/i });
    await user.click(selector);

    // Non-imported intervals should be visible
    expect(await screen.findByText('normal-1')).toBeInTheDocument();
    expect(screen.getByText('normal-2')).toBeInTheDocument();
    expect(screen.getByText('file-1')).toBeInTheDocument();

    // Imported intervals should NOT be visible
    expect(screen.queryByText('imported-1')).not.toBeInTheDocument();
    expect(screen.queryByText('imported-2')).not.toBeInTheDocument();
  });

  it('should handle empty list', async () => {
    setTimeIntervalsList([]);

    renderWithProvider();

    // Selector should be present but have no options
    const selector = await screen.findByRole('combobox', { name: /time intervals/i });
    expect(selector).toBeInTheDocument();
  });

  it('should handle list with only imported intervals', async () => {
    const user = userEvent.setup();
    setTimeIntervalsList([
      { name: 'imported-1', provenance: 'prometheus_convert' },
      { name: 'imported-2', provenance: 'prometheus_convert' },
    ]);

    renderWithProvider();

    // Click to open the dropdown
    const selector = await screen.findByRole('combobox', { name: /time intervals/i });
    await user.click(selector);

    // No intervals should be visible
    expect(screen.queryByText('imported-1')).not.toBeInTheDocument();
    expect(screen.queryByText('imported-2')).not.toBeInTheDocument();
  });
});
