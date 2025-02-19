import { render, screen, userEvent, within } from 'test/test-utils';

import { config } from '@grafana/runtime';
import { defaultConfig } from 'app/features/alerting/unified/MuteTimings.test';
import { setupMswServer } from 'app/features/alerting/unified/mockApi';
import { setMuteTimingsListError } from 'app/features/alerting/unified/mocks/server/configure';
import { setAlertmanagerConfig } from 'app/features/alerting/unified/mocks/server/entities/alertmanagers';
import { captureRequests } from 'app/features/alerting/unified/mocks/server/events';
import { AlertManagerCortexConfig } from 'app/plugins/datasource/alertmanager/types';
import { AccessControlAction } from 'app/types';

import { grantUserPermissions } from '../../mocks';
import { TIME_INTERVAL_UID_HAPPY_PATH } from '../../mocks/server/handlers/k8s/timeIntervals.k8s';
import { AlertmanagerProvider } from '../../state/AlertmanagerContext';
import { GRAFANA_RULES_SOURCE_NAME } from '../../utils/datasource';

import { MuteTimingsTable } from './MuteTimingsTable';

const renderWithProvider = (alertManagerSource?: string) => {
  return render(
    <AlertmanagerProvider accessType={'notification'} alertmanagerSourceName={alertManagerSource}>
      <MuteTimingsTable />
    </AlertmanagerProvider>
  );
};

setupMswServer();

describe('MuteTimingsTable', () => {
  describe('with necessary permissions', () => {
    beforeEach(() => {
      setAlertmanagerConfig(GRAFANA_RULES_SOURCE_NAME, defaultConfig);
      config.featureToggles.alertingApiServer = false;
      grantUserPermissions([
        AccessControlAction.AlertingNotificationsRead,
        AccessControlAction.AlertingNotificationsWrite,
      ]);
    });

    it("shows 'export all' drawer when allowed and supported", async () => {
      const user = userEvent.setup();
      renderWithProvider();
      await user.click(await screen.findByRole('button', { name: /export all/i }));

      expect(await screen.findByRole('dialog', { name: /drawer title export/i })).toBeInTheDocument();
    });

    it("shows individual 'export' drawer when allowed and supported, and can close", async () => {
      const user = userEvent.setup();
      renderWithProvider();
      const table = await screen.findByTestId('dynamic-table');
      const exportMuteTiming = await within(table).findByText(/export/i);
      await user.click(exportMuteTiming);

      expect(await screen.findByRole('dialog', { name: /drawer title export/i })).toBeInTheDocument();

      await user.click(screen.getByText(/cancel/i));

      expect(screen.queryByRole('dialog', { name: /drawer title export/i })).not.toBeInTheDocument();
    });

    it('does not show export button when not supported', async () => {
      renderWithProvider('potato');
      expect(screen.queryByRole('button', { name: /export all/i })).not.toBeInTheDocument();
    });

    it('deletes interval', async () => {
      // TODO: Don't use captureRequests for this, move to stateful mock server instead
      // and check that the interval is no longer in the list
      const capture = captureRequests();
      const user = userEvent.setup();
      renderWithProvider();

      await user.click((await screen.findAllByText(/delete/i))[0]);
      await user.click(await screen.findByRole('button', { name: /delete/i }));

      const requests = await capture;
      const amConfigUpdateRequest = requests.find(
        (r) => r.url.includes('/alertmanager/grafana/config/api/v1/alerts') && r.method === 'POST'
      );

      const body: AlertManagerCortexConfig = await amConfigUpdateRequest?.clone().json();
      expect(body.alertmanager_config.mute_time_intervals).toHaveLength(0);
    });

    it('allow cancelling deletion', async () => {
      // TODO: Don't use captureRequests for this, move to stateful mock server instead
      // and check that the interval is still in the list
      const capture = captureRequests();
      const user = userEvent.setup();
      renderWithProvider();

      await user.click((await screen.findAllByText(/delete/i))[0]);
      await user.click(await screen.findByRole('button', { name: /cancel/i }));

      const requests = await capture;
      const amConfigUpdateRequest = requests.find(
        (r) => r.url.includes('/alertmanager/grafana/config/api/v1/alerts') && r.method === 'POST'
      );

      expect(amConfigUpdateRequest).toBeUndefined();
    });
  });

  describe('without necessary permissions', () => {
    beforeEach(() => {
      grantUserPermissions([]);
    });

    it('does not show export button when not allowed ', async () => {
      renderWithProvider();
      expect(screen.queryByRole('button', { name: /export all/i })).not.toBeInTheDocument();
    });
  });

  describe('using alertingApiServer feature toggle', () => {
    beforeEach(() => {
      config.featureToggles.alertingApiServer = true;
      grantUserPermissions([
        AccessControlAction.AlertingNotificationsRead,
        AccessControlAction.AlertingNotificationsWrite,
      ]);
    });

    afterEach(() => {
      config.featureToggles.alertingApiServer = false;
    });

    it('shows list of intervals from k8s API', async () => {
      renderWithProvider();
      expect(await screen.findByTestId('dynamic-table')).toBeInTheDocument();

      expect(await screen.findByText('Provisioned')).toBeInTheDocument();
    });

    it('shows error when mute timings cannot load', async () => {
      setMuteTimingsListError();
      renderWithProvider();
      expect(await screen.findByText(/error loading mute timings/i)).toBeInTheDocument();
    });

    it('deletes interval', async () => {
      // TODO: Don't use captureRequests for this, move to stateful mock server instead
      // and check that the interval is no longer in the list
      const capture = captureRequests();
      const user = userEvent.setup();
      renderWithProvider();

      await user.click((await screen.findAllByText(/delete/i))[0]);
      await user.click(await screen.findByRole('button', { name: /delete/i }));

      const requests = await capture;
      const deleteRequest = requests.find(
        (r) => r.url.includes(`timeintervals/${TIME_INTERVAL_UID_HAPPY_PATH}`) && r.method === 'DELETE'
      );

      expect(deleteRequest).toBeDefined();
    });
  });
});
