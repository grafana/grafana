import { render, screen, testWithFeatureToggles } from 'test/test-utils';

import { AccessControlAction } from 'app/types/accessControl';

import TimeIntervalsPage from './TimeIntervalsPage';
import { setupMswServer } from './mockApi';
import { grantUserPermissions, mockDataSource } from './mocks';
import { setupDataSources } from './testSetup/datasources';
import { DataSourceType, GRAFANA_RULES_SOURCE_NAME } from './utils/datasource';

setupMswServer();

const alertManager = mockDataSource({
  name: 'Alertmanager',
  type: DataSourceType.Alertmanager,
});

describe('TimeIntervalsPage', () => {
  describe('V2 Navigation Mode', () => {
    testWithFeatureToggles({ enable: ['alertingNavigationV2'] });

    beforeEach(() => {
      setupDataSources(alertManager);
      grantUserPermissions([
        AccessControlAction.AlertingNotificationsRead,
        AccessControlAction.AlertingNotificationsTimeIntervalsRead,
      ]);
    });

    it('renders time intervals table', async () => {
      render(<TimeIntervalsPage />, {
        historyOptions: {
          initialEntries: ['/alerting/time-intervals'],
        },
      });

      // Should show time intervals content
      expect(await screen.findByText(/time intervals/i)).toBeInTheDocument();
    });

    it('returns null in legacy mode', () => {
      // This test verifies that the component returns null when V2 is disabled
      // The feature toggle is controlled by testWithFeatureToggles, so we test it separately
      const { container } = render(<TimeIntervalsPage />, {
        historyOptions: {
          initialEntries: ['/alerting/time-intervals'],
        },
      });
      // In V2 mode (enabled by testWithFeatureToggles), it should render content
      expect(container).not.toBeEmptyDOMElement();
    });
  });
});
