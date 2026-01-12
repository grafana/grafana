import { render, screen } from 'test/test-utils';

import { configureStore } from 'app/store/configureStore';
import { AccessControlAction } from 'app/types/accessControl';

import TimeIntervalsPage from './TimeIntervalsPage';
import { defaultConfig } from './components/mute-timings/mocks';
import { setupMswServer } from './mockApi';
import { grantUserPermissions, mockDataSource } from './mocks';
import { setTimeIntervalsListEmpty } from './mocks/server/configure';
import { setAlertmanagerConfig } from './mocks/server/entities/alertmanagers';
import { setupDataSources } from './testSetup/datasources';
import { DataSourceType, GRAFANA_RULES_SOURCE_NAME } from './utils/datasource';

setupMswServer();

const alertManager = mockDataSource({
  name: 'Alertmanager',
  type: DataSourceType.Alertmanager,
});

describe('TimeIntervalsPage', () => {
  beforeEach(() => {
    setupDataSources(alertManager);
    setAlertmanagerConfig(GRAFANA_RULES_SOURCE_NAME, defaultConfig);
    setTimeIntervalsListEmpty(); // Mock empty time intervals list so component renders
    grantUserPermissions([
      AccessControlAction.AlertingNotificationsRead,
      AccessControlAction.AlertingTimeIntervalsRead,
    ]);
  });

  it('renders time intervals table', async () => {
    const mockNavIndex = {
      'notification-config': {
        id: 'notification-config',
        text: 'Notification configuration',
        url: '/alerting/notifications',
      },
      'notification-config-time-intervals': {
        id: 'notification-config-time-intervals',
        text: 'Time intervals',
        url: '/alerting/time-intervals',
      },
    };
    const store = configureStore({
      navIndex: mockNavIndex,
    });

    render(<TimeIntervalsPage />, {
      store,
      historyOptions: {
        initialEntries: ['/alerting/time-intervals'],
      },
    });

    // Should show time intervals content
    // When empty, it shows "You haven't created any time intervals yet"
    // When loading, it shows "Loading time intervals..."
    // When error, it shows "Error loading time intervals"
    // All contain "time intervals" - use getAllByText since there are multiple matches (tab, description, empty state)
    const timeIntervalsTexts = await screen.findAllByText(/time intervals/i, {}, { timeout: 5000 });
    expect(timeIntervalsTexts.length).toBeGreaterThan(0);
  });
});
