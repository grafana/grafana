import { HttpResponse, http } from 'msw';
import { render, screen, waitFor } from 'test/test-utils';

import { AppNotificationList } from 'app/core/components/AppNotifications/AppNotificationList';
import { AccessControlAction } from 'app/types/accessControl';
import { GrafanaRuleIdentifier } from 'app/types/unified-alerting';

import { setupMswServer } from '../mockApi';
import { grantUserPermissions } from '../mocks';
import { grafanaRulerNamespace, grafanaRulerRule } from '../mocks/grafanaRulerApi';
import { GRAFANA_RULES_SOURCE_NAME } from '../utils/datasource';

import { useCombinedRule } from './useCombinedRule';

const server = setupMswServer();

beforeAll(() => {
  grantUserPermissions([AccessControlAction.AlertingRuleExternalRead, AccessControlAction.AlertingRuleRead]);
});

// Test component that uses useCombinedRule hook
const UseCombinedRuleTestComponent = ({ ruleIdentifier }: { ruleIdentifier: GrafanaRuleIdentifier }) => {
  const { loading, error, result } = useCombinedRule({ ruleIdentifier });

  return (
    <>
      <AppNotificationList />
      <div data-testid="loading">{loading ? 'loading' : 'not-loading'}</div>
      <div data-testid="error">{error ? 'has-error' : 'no-error'}</div>
      <div data-testid="result">{result ? 'has-result' : 'no-result'}</div>
    </>
  );
};

describe('useCombinedRule', () => {
  describe('when rule group returns 404', () => {
    it('should not show error notification when rule group does not exist', async () => {
      // Mock the getAlertRule endpoint to return a valid rule
      server.use(
        http.get('/api/ruler/grafana/api/v1/rule/:uid', () => {
          return HttpResponse.json(grafanaRulerRule);
        })
      );

      // Mock the ruler group endpoint to return 404 (simulating a new or deleted group)
      server.use(
        http.get('/api/ruler/grafana/api/v1/rules/:namespace/:group', () => {
          return HttpResponse.json({ error: 'rule group does not exist' }, { status: 404 });
        })
      );

      // Mock the prometheus rules endpoint
      server.use(
        http.get('/api/prometheus/grafana/api/v1/rules', () => {
          return HttpResponse.json({
            status: 'success',
            data: { groups: [] },
          });
        })
      );

      // Mock the folder endpoint
      server.use(
        http.get('/api/folders/:uid', () => {
          return HttpResponse.json({
            uid: grafanaRulerNamespace.uid,
            title: grafanaRulerNamespace.name,
          });
        })
      );

      const ruleIdentifier: GrafanaRuleIdentifier = {
        ruleSourceName: GRAFANA_RULES_SOURCE_NAME,
        uid: grafanaRulerRule.grafana_alert.uid,
      };

      render(<UseCombinedRuleTestComponent ruleIdentifier={ruleIdentifier} />);

      // Wait for the hook to finish loading
      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('not-loading');
      });

      // The hook should have an error (404)
      expect(screen.getByTestId('error')).toHaveTextContent('has-error');

      // Verify that no error notification was shown
      // If showErrorAlert was true, we would see an alert with role="status"
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });
  });
});
