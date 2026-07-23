import { HttpResponse, http } from 'msw';
import { render, screen, waitFor } from 'test/test-utils';

import { AppNotificationList } from 'app/core/components/AppNotifications/AppNotificationList';
import { AccessControlAction } from 'app/types/accessControl';
import { type GrafanaRuleIdentifier } from 'app/types/unified-alerting';

import { setupMswServer } from '../mockApi';
import { grantUserPermissions, mockGrafanaPromAlertingRule } from '../mocks';
import {
  grafanaRulerGroup,
  grafanaRulerGroupName,
  grafanaRulerNamespace,
  grafanaRulerRule,
} from '../mocks/grafanaRulerApi';
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
      <div data-testid="prom">{result?.promRule ? 'has-prom' : 'no-prom'}</div>
      <div data-testid="namespace">{result?.namespace.name ?? 'no-namespace'}</div>
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

  describe('combining Grafana Ruler and Prometheus rules', () => {
    it('attaches the Prometheus rule to the combined rule using the namespace name returned by the API', async () => {
      // getAlertRule -> ruleLocation (folder UID, group, title)
      server.use(http.get('/api/ruler/grafana/api/v1/rule/:uid', () => HttpResponse.json(grafanaRulerRule)));

      // Ruler group for the folder
      server.use(
        http.get('/api/ruler/grafana/api/v1/rules/:namespace/:group', () => HttpResponse.json(grafanaRulerGroup))
      );

      // Folder titled "my/folder" -> stringifyFolder() would produce the escaped "my\/folder"
      server.use(
        http.get('/api/folders/:uid', () => HttpResponse.json({ uid: grafanaRulerNamespace.uid, title: 'my/folder' }))
      );

      // Prometheus returns the same folder but with a different namespace name (here the unescaped
      // "my/folder"), simulating a backend whose fullpath escaping does not byte-match the client's.
      // The rule must still be paired with its Prometheus counterpart via the name the API returned.
      server.use(
        http.get('/api/prometheus/grafana/api/v1/rules', () =>
          HttpResponse.json({
            status: 'success',
            data: {
              groups: [
                {
                  name: grafanaRulerGroupName,
                  file: 'my/folder',
                  folderUid: grafanaRulerNamespace.uid,
                  interval: 60,
                  rules: [
                    mockGrafanaPromAlertingRule({
                      uid: grafanaRulerRule.grafana_alert.uid,
                      name: grafanaRulerRule.grafana_alert.title,
                      folderUid: grafanaRulerNamespace.uid,
                    }),
                  ],
                },
              ],
            },
          })
        )
      );

      const ruleIdentifier: GrafanaRuleIdentifier = {
        ruleSourceName: GRAFANA_RULES_SOURCE_NAME,
        uid: grafanaRulerRule.grafana_alert.uid,
      };

      render(<UseCombinedRuleTestComponent ruleIdentifier={ruleIdentifier} />);

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('not-loading');
      });

      expect(screen.getByTestId('error')).toHaveTextContent('no-error');
      expect(screen.getByTestId('result')).toHaveTextContent('has-result');
      // Without aligning to the API's namespace name, the Prometheus rule (and its instances)
      // would land in a separate namespace and never attach, leaving this as 'no-prom'.
      expect(screen.getByTestId('prom')).toHaveTextContent('has-prom');
    });

    it('falls back to the derived folder namespace when Prometheus returns no rule', async () => {
      server.use(http.get('/api/ruler/grafana/api/v1/rule/:uid', () => HttpResponse.json(grafanaRulerRule)));
      server.use(
        http.get('/api/ruler/grafana/api/v1/rules/:namespace/:group', () => HttpResponse.json(grafanaRulerGroup))
      );
      server.use(
        http.get('/api/folders/:uid', () => HttpResponse.json({ uid: grafanaRulerNamespace.uid, title: 'my/folder' }))
      );
      server.use(
        http.get('/api/prometheus/grafana/api/v1/rules', () =>
          HttpResponse.json({ status: 'success', data: { groups: [] } })
        )
      );

      render(
        <UseCombinedRuleTestComponent
          ruleIdentifier={{
            ruleSourceName: GRAFANA_RULES_SOURCE_NAME,
            uid: grafanaRulerRule.grafana_alert.uid,
          }}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('not-loading');
      });

      expect(screen.getByTestId('error')).toHaveTextContent('no-error');
      expect(screen.getByTestId('result')).toHaveTextContent('has-result');
      expect(screen.getByTestId('prom')).toHaveTextContent('no-prom');
      expect(screen.getByTestId('namespace')).toHaveTextContent('my\\/folder');
    });
  });
});
