import { http, HttpResponse } from 'msw';
import { useState, type Ref } from 'react';
import { act } from 'test/test-utils';

import { type PluginMeta } from '@grafana/data';
import { setBackendSrv, setPluginComponentsHook } from '@grafana/runtime';
import { invalidateCachedPromisesCache } from '@grafana/runtime/internal';
import { mockComboboxRect } from '@grafana/test-utils';
import server, { setupMockServer } from '@grafana/test-utils/server';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { backendSrv } from 'app/core/services/backend_srv';
import { contextSrv } from 'app/core/services/context_srv';
import { type IncidentPreview } from 'app/features/alerting/unified/api/incidentsApi';
import { mockGrafanaPromAlertingRule, mockGrafanaPromRuleGroup } from 'app/features/alerting/unified/mocks';
import { setGrafanaPromRules } from 'app/features/alerting/unified/mocks/server/configure';
import {
  installAppPluginMeta,
  pluginMeta,
  uninstallAppPluginMeta,
} from 'app/features/alerting/unified/testSetup/plugins';
import { SupportedPlugin } from 'app/features/alerting/unified/types/pluginBridges';
import { AlertState, type AlertmanagerAlert } from 'app/plugins/datasource/alertmanager/types';
import { AccessControlAction } from 'app/types/accessControl';
import { type Labels } from 'app/types/unified-alerting-dto';

import { AlertIncidentTabs, type AlertIncidentSwitchHandle } from './AlertIncidentTabs';
import { type FilterSelection } from './filterSelection';
import { mockNoIncidentFields } from './mockIncidentsApi';
import { useFiringAlerts } from './useFiringAlerts';
import { useIncidents } from './useIncidents';

export function makeAlert(
  overrides: Partial<AlertmanagerAlert> & { labels: AlertmanagerAlert['labels'] }
): AlertmanagerAlert {
  return {
    startsAt: new Date(Date.now() - 60_000).toISOString(),
    updatedAt: new Date().toISOString(),
    endsAt: '0001-01-01T00:00:00Z',
    fingerprint: Math.random().toString(36).slice(2),
    receivers: [{ name: 'default' }],
    status: { state: AlertState.Active, silencedBy: [], inhibitedBy: [] },
    annotations: {},
    ...overrides,
    labels: { alertname: 'test', ...overrides.labels },
  };
}

export function mockTeams(teams: Array<{ name: string }>) {
  server.use(
    http.get('/api/user/teams', () =>
      HttpResponse.json(
        teams.map((t, i) => ({ ...t, id: i + 1, uid: `team-${i}`, orgId: 1, memberCount: 1, isProvisioned: false }))
      )
    )
  );
}

export const RULES_URL = '/api/prometheus/grafana/api/v1/rules';

/** Mocks the org's alert rules, one per label set; returns the query params of each rules request received. */
export function mockRuleLabels(...ruleLabels: Labels[]) {
  setGrafanaPromRules([
    mockGrafanaPromRuleGroup({ rules: ruleLabels.map((labels) => mockGrafanaPromAlertingRule({ labels })) }),
  ]);
  const requests: URLSearchParams[] = [];
  // Only records: returning nothing hands the request on to the rules mocked above.
  server.use(
    http.get(RULES_URL, ({ request }) => {
      requests.push(new URL(request.url).searchParams);
    })
  );
  return requests;
}

/** One alert rule per value, each setting it as its `team` label. */
export function mockTeamLabelValues(values: string[]) {
  return mockRuleLabels(...values.map((team) => ({ team })));
}

/** Mocks the alertmanager alerts endpoint; returns the `filter` query params of each request received. */
export function mockAlerts(alerts: AlertmanagerAlert[]) {
  const requests: string[][] = [];
  server.use(
    http.get('/api/alertmanager/:datasourceUid/api/v2/alerts', ({ request }) => {
      requests.push(new URL(request.url).searchParams.getAll('filter'));
      return HttpResponse.json(alerts);
    })
  );
  return requests;
}

/** Report the IRM plugin as absent so the component only shows the alerts tab. */
function mockNoIrmPlugin() {
  uninstallAppPluginMeta(SupportedPlugin.Irm);
  server.use(http.get('/api/plugins/:pluginId/settings', () => HttpResponse.json({ enabled: false })));
}

/** Install the IRM plugin with optional page includes for access gating. */
export function mockIrmPlugin(settings?: Partial<PluginMeta>) {
  // the bridge checks bootdata before requesting settings, so the app has to be registered there too
  installAppPluginMeta(pluginMeta[SupportedPlugin.Irm]);
  server.use(
    http.get(`/api/plugins/${SupportedPlugin.Irm}/settings`, () =>
      HttpResponse.json({ ...pluginMeta[SupportedPlugin.Irm], includes: [], ...settings })
    )
  );
}

export const activeIncident: IncidentPreview = {
  incidentID: '101',
  title: 'Database outage',
  severityLabel: 'Critical',
  createdTime: '2024-01-02T10:00:00Z',
};

/**
 * Registers the mock server and the per-test defaults. Call at the top of the test file, which
 * still has to `jest.mock` the analytics module and `contextSrv.hasPermission` itself.
 */
export function setupAlertIncidentTabsTests() {
  setBackendSrv(backendSrv);
  setupMockServer();
  // The filter Combobox virtualizes its options; without mocked element rects
  // the virtualizer measures 0 height in jsdom and renders no options.
  mockComboboxRect();

  beforeEach(async () => {
    setPluginComponentsHook(() => ({ components: [], isLoading: false }));
    // Grant alerting permissions by default: reading alerts, and reading rules for the filter's labels.
    jest
      .spyOn(contextSrv, 'hasPermission')
      .mockImplementation(
        (action: string) =>
          action === AccessControlAction.AlertingInstanceRead || action === AccessControlAction.AlertingRuleRead
      );

    mockTeams([]);
    // No alert rules by default, so the alerts dropdown only offers its scope options.
    mockRuleLabels();
    mockAlerts([]);
    // The component probes the IRM plugin settings; absent by default.
    // Tests that need the incidents tab layer mockIrmPlugin() on top.
    mockNoIrmPlugin();
    // No custom fields by default, so the incidents dropdown stays hidden.
    mockNoIncidentFields();
    // AlertIncidentTabs only ships in the growth-homepage redesign, which is flag-gated,
    // so exercise it in the same flag state it renders in production.
    await act(async () => {
      setTestFlags({ 'grafana.growthHomepage': true });
    });
  });

  afterEach(async () => {
    // Wrap in act() because setTestFlags fires OpenFeature events that trigger React state updates.
    await act(async () => {
      setTestFlags({});
    });
    jest.restoreAllMocks();
    // getPluginSettings memoizes per plugin ID at module scope; clear it so each
    // test's plugin-settings handler actually gets hit.
    invalidateCachedPromisesCache();
  });
}

export function AlertIncidentTabsWithData({
  switchRef,
  initialIncidentsFilter = '',
}: { switchRef?: Ref<AlertIncidentSwitchHandle>; initialIncidentsFilter?: FilterSelection } = {}) {
  const [alertsFilter, setAlertsFilter] = useState<FilterSelection>('');
  const [incidentsFilter, setIncidentsFilter] = useState<FilterSelection>(initialIncidentsFilter);
  const alertsData = useFiringAlerts(alertsFilter);
  const incidentsData = useIncidents(incidentsFilter);
  return (
    <AlertIncidentTabs
      alertsData={alertsData}
      incidentsData={incidentsData}
      alertsFilter={alertsFilter}
      onAlertsFilterChange={setAlertsFilter}
      incidentsFilter={incidentsFilter}
      onIncidentsFilterChange={setIncidentsFilter}
      switchRef={switchRef}
    />
  );
}
