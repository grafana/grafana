import { render, screen } from 'test/test-utils';

import {
  GRAFANA_AM_VISIBILITY_PERMISSION,
  setupGrafanaAlertmanager,
} from '../../hooks/abilities/alertmanager/abilityTestUtils';
import { setupMswServer } from '../../mockApi';
import { grantUserPermissions, mockAlertGroup } from '../../mocks';
import { AlertmanagerProvider } from '../../state/AlertmanagerContext';

import { AlertGroup } from './AlertGroup';

setupMswServer();

function renderAlertGroup(alertManagerSourceName: string) {
  const group = mockAlertGroup();
  return render(
    <AlertmanagerProvider accessType="notification" alertmanagerSourceName={alertManagerSourceName}>
      <AlertGroup group={group} alertManagerSourceName={alertManagerSourceName} />
    </AlertmanagerProvider>
  );
}

describe('AlertGroup', () => {
  describe('contact point visibility', () => {
    it('renders contact point name as a clickable link when user can view contact points', () => {
      const amSource = setupGrafanaAlertmanager();
      // GRAFANA_AM_VISIBILITY_PERMISSION === AlertingNotificationsRead, which also gates contact point view
      grantUserPermissions([GRAFANA_AM_VISIBILITY_PERMISSION]);

      renderAlertGroup(amSource);

      expect(screen.getByRole('link', { name: /pagerduty/i })).toBeInTheDocument();
    });

    it('renders contact point name as plain text with tooltip when user cannot view contact points', () => {
      const amSource = setupGrafanaAlertmanager();
      // Granting no permissions: the Grafana AM does not resolve in available alertmanagers
      // so contact point view falls back to external permissions, which are not held — denied.
      grantUserPermissions([]);

      renderAlertGroup(amSource);

      expect(screen.queryByRole('link', { name: /pagerduty/i })).not.toBeInTheDocument();
      expect(screen.getByText(/delivered to pagerduty/i)).toBeInTheDocument();
    });
  });
});
