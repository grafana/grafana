import { render, screen, userEvent, within } from 'test/test-utils';

import { setupMswServer } from 'app/features/alerting/unified/mockApi';
import {
  setMuteTimingsListError,
  setTimeIntervalsListEmpty,
} from 'app/features/alerting/unified/mocks/server/configure';
import { setAlertmanagerConfig } from 'app/features/alerting/unified/mocks/server/entities/alertmanagers';
import { captureRequests } from 'app/features/alerting/unified/mocks/server/events';
import { AccessControlAction } from 'app/types/accessControl';

import { grantUserPermissions } from '../../mocks';
import { TIME_INTERVAL_UID_HAPPY_PATH } from '../../mocks/server/handlers/k8s/timeIntervals.k8s';
import { AlertmanagerProvider } from '../../state/AlertmanagerContext';
import { GRAFANA_RULES_SOURCE_NAME } from '../../utils/datasource';

import { TimeIntervalsTable } from './MuteTimingsTable';
import { defaultConfig } from './mocks';

const renderWithProvider = (alertManagerSource = GRAFANA_RULES_SOURCE_NAME) => {
  return render(
    <AlertmanagerProvider accessType={'notification'} alertmanagerSourceName={alertManagerSource}>
      <TimeIntervalsTable />
    </AlertmanagerProvider>
  );
};

setupMswServer();

describe('MuteTimingsTable', () => {
  beforeEach(() => {
    window.localStorage.clear();
    // setupDataSources();
  });

  describe('with necessary permissions', () => {
    beforeEach(() => {
      setAlertmanagerConfig(GRAFANA_RULES_SOURCE_NAME, defaultConfig);

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
      const { user } = renderWithProvider();
      const table = await screen.findByTestId('dynamic-table');
      const exportMuteTiming = await within(table).findAllByText(/export/i);
      await user.click(exportMuteTiming[0]);

      expect(await screen.findByRole('dialog', { name: /drawer title export/i })).toBeInTheDocument();

      await user.click(screen.getByText(/cancel/i));

      expect(screen.queryByRole('dialog', { name: /drawer title export/i })).not.toBeInTheDocument();
    });

    it('does not show export button when not supported', async () => {
      renderWithProvider('potato');
      expect(screen.queryByRole('button', { name: /export all/i })).not.toBeInTheDocument();
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

    it('shows list of intervals from API', async () => {
      renderWithProvider(GRAFANA_RULES_SOURCE_NAME);
      expect(await screen.findByTestId('dynamic-table')).toBeInTheDocument();

      expect(await screen.findByText('Provisioned')).toBeInTheDocument();
      expect(screen.queryByText(/no time intervals configured/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/you haven't created any time in intervals yet/i)).not.toBeInTheDocument();
    });

    it('shows error when mute timings cannot load', async () => {
      setMuteTimingsListError();
      renderWithProvider();
      expect(await screen.findByText(/error loading time intervals/i)).toBeInTheDocument();
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

    it('shows empty state when no mute timings are configured', async () => {
      setTimeIntervalsListEmpty();
      renderWithProvider();
      expect(await screen.findByText(/you haven't created any time intervals yet/i)).toBeInTheDocument();
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
});
