import { render, screen } from 'test/test-utils';

import { MIMIR_DATASOURCE_UID } from 'app/features/alerting/unified/mocks/server/constants';
import { AlertState } from 'app/plugins/datasource/alertmanager/types';
import { AccessControlAction } from 'app/types/accessControl';

import {
  EXTERNAL_AM_VISIBILITY_PERMISSION,
  GRAFANA_AM_VISIBILITY_PERMISSION,
  setupGrafanaAlertmanager,
  setupMimirAlertmanager,
} from '../../hooks/abilities/alertmanager/abilityTestUtils';
import { setupMswServer } from '../../mockApi';
import { grantUserPermissions, mockAlertmanagerAlert } from '../../mocks';
import { AlertmanagerProvider } from '../../state/AlertmanagerContext';

import { AlertDetails } from './AlertDetails';

setupMswServer();

function renderAlertDetails(alert: ReturnType<typeof mockAlertmanagerAlert>, alertManagerSourceName: string) {
  return render(
    <AlertmanagerProvider accessType="notification" alertmanagerSourceName={alertManagerSourceName}>
      <AlertDetails alert={alert} alertManagerSourceName={alertManagerSourceName} />
    </AlertmanagerProvider>
  );
}

describe('AlertDetails', () => {
  describe('Silence button — Active alert', () => {
    it('shows Silence button when user can create silences', () => {
      const amSource = setupGrafanaAlertmanager();
      grantUserPermissions([GRAFANA_AM_VISIBILITY_PERMISSION, AccessControlAction.AlertingInstanceCreate]);
      const alert = mockAlertmanagerAlert({ status: { state: AlertState.Active, silencedBy: [], inhibitedBy: [] } });

      renderAlertDetails(alert, amSource);

      expect(screen.getByRole('link', { name: /silence/i })).toBeInTheDocument();
    });

    it('hides Silence button when user has no silence create permission', () => {
      const amSource = setupGrafanaAlertmanager();
      grantUserPermissions([GRAFANA_AM_VISIBILITY_PERMISSION]);
      const alert = mockAlertmanagerAlert({ status: { state: AlertState.Active, silencedBy: [], inhibitedBy: [] } });

      renderAlertDetails(alert, amSource);

      expect(screen.queryByRole('link', { name: /silence/i })).not.toBeInTheDocument();
    });
  });

  describe('Manage silences button — Suppressed alert', () => {
    it('shows Manage silences button when user can create silences', () => {
      const amSource = setupGrafanaAlertmanager();
      grantUserPermissions([GRAFANA_AM_VISIBILITY_PERMISSION, AccessControlAction.AlertingInstanceCreate]);
      const alert = mockAlertmanagerAlert({
        status: { state: AlertState.Suppressed, silencedBy: ['abc123'], inhibitedBy: [] },
      });

      renderAlertDetails(alert, amSource);

      expect(screen.getByRole('link', { name: /manage silences/i })).toBeInTheDocument();
    });

    it('shows Manage silences button when user can update silences but not create', () => {
      const amSource = setupGrafanaAlertmanager();
      grantUserPermissions([GRAFANA_AM_VISIBILITY_PERMISSION, AccessControlAction.AlertingInstanceUpdate]);
      const alert = mockAlertmanagerAlert({
        status: { state: AlertState.Suppressed, silencedBy: ['abc123'], inhibitedBy: [] },
      });

      renderAlertDetails(alert, amSource);

      expect(screen.getByRole('link', { name: /manage silences/i })).toBeInTheDocument();
    });

    it('hides Manage silences button when user has neither create nor update silence permission', () => {
      const amSource = setupGrafanaAlertmanager();
      grantUserPermissions([GRAFANA_AM_VISIBILITY_PERMISSION]);
      const alert = mockAlertmanagerAlert({
        status: { state: AlertState.Suppressed, silencedBy: ['abc123'], inhibitedBy: [] },
      });

      renderAlertDetails(alert, amSource);

      expect(screen.queryByRole('link', { name: /manage silences/i })).not.toBeInTheDocument();
    });
  });

  describe('See alert rule button — Grafana source', () => {
    it('shows See alert rule button when user has rule read permission', () => {
      const amSource = setupGrafanaAlertmanager();
      grantUserPermissions([GRAFANA_AM_VISIBILITY_PERMISSION, AccessControlAction.AlertingRuleRead]);
      const alert = mockAlertmanagerAlert({
        status: { state: AlertState.Active, silencedBy: [], inhibitedBy: [] },
        generatorURL: 'https://play.grafana.com/alerting/grafana/rule/123/view',
      });

      renderAlertDetails(alert, amSource);

      expect(screen.getByRole('link', { name: /see alert rule/i })).toBeInTheDocument();
    });

    it('hides See alert rule button when user lacks rule read permission', () => {
      const amSource = setupGrafanaAlertmanager();
      grantUserPermissions([GRAFANA_AM_VISIBILITY_PERMISSION]);
      const alert = mockAlertmanagerAlert({
        status: { state: AlertState.Active, silencedBy: [], inhibitedBy: [] },
        generatorURL: 'https://play.grafana.com/alerting/grafana/rule/123/view',
      });

      renderAlertDetails(alert, amSource);

      expect(screen.queryByRole('link', { name: /see alert rule/i })).not.toBeInTheDocument();
    });
  });

  describe('See source button — external source', () => {
    it('always shows See source button regardless of rule read permission', () => {
      setupMimirAlertmanager(MIMIR_DATASOURCE_UID);
      grantUserPermissions([EXTERNAL_AM_VISIBILITY_PERMISSION]);
      const alert = mockAlertmanagerAlert({
        status: { state: AlertState.Active, silencedBy: [], inhibitedBy: [] },
        generatorURL: 'https://external-alertmanager.example.com',
      });

      renderAlertDetails(alert, MIMIR_DATASOURCE_UID);

      expect(screen.getByRole('link', { name: /see source/i })).toBeInTheDocument();
    });
  });
});
