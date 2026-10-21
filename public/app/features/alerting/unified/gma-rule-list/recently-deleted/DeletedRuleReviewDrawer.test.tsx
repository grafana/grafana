import { HttpResponse, http } from 'msw';
import { render, screen, waitFor, within } from 'test/test-utils';

import { type AlertRule, type RecordingRule } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { setBackendSrv } from '@grafana/runtime';
import server, { setupMockServer } from '@grafana/test-utils/server';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { backendSrv } from 'app/core/services/backend_srv';
import { mockDashboardApi } from 'app/features/alerting/unified/mockApi';
import { mockDashboardDto, mockDataSource } from 'app/features/alerting/unified/mocks';
import { setupDataSources } from 'app/features/alerting/unified/testSetup/datasources';
import { DataSourceType } from 'app/features/alerting/unified/utils/datasource';

import { FOLDER_PARENTS_URL } from '../mocks/handlers';

import { DeletedRuleReviewDrawer } from './DeletedRuleReviewDrawer';

setBackendSrv(backendSrv);
setupMockServer();
setupDataSources(mockDataSource({ uid: 'prom-uid', name: 'Prometheus', type: DataSourceType.Prometheus }));

function buildAlertRule(spec: Partial<AlertRule['spec']> = {}): AlertRule {
  return {
    apiVersion: 'v0alpha1',
    kind: 'AlertRule',
    metadata: {
      name: 'rule-uid-1',
      annotations: { 'grafana.app/folder': 'folder-uid-1' },
      deletionTimestamp: '2024-05-01T00:00:00Z',
    },
    spec: {
      title: 'High CPU usage',
      execErrState: 'Alerting',
      noDataState: 'NoData',
      trigger: { interval: '1m' },
      expressions: {},
      ...spec,
    },
  };
}

function buildRecordingRule(spec: Partial<RecordingRule['spec']> = {}): RecordingRule {
  return {
    apiVersion: 'v0alpha1',
    kind: 'RecordingRule',
    metadata: {
      name: 'recording-uid-1',
      annotations: { 'grafana.app/folder': 'folder-uid-1' },
      deletionTimestamp: '2024-05-01T00:00:00Z',
    },
    spec: {
      title: 'CPU usage average',
      metric: 'cpu_usage:avg',
      targetDatasourceUID: 'prom-uid',
      trigger: { interval: '1m' },
      expressions: {},
      ...spec,
    },
  };
}

const QUERY_AND_MATH_EXPRESSIONS = {
  A: {
    datasourceUID: 'prom-uid',
    model: { refId: 'A', expr: 'sum(rate(cpu_seconds_total[5m]))', datasource: { uid: 'prom-uid' }, intervalMs: 1000 },
  },
  B: {
    datasourceUID: '__expr__',
    model: { refId: 'B', type: 'math', expression: '$A > 0.8' },
    source: true,
  },
};

describe('DeletedRuleReviewDrawer', () => {
  beforeEach(() => {
    server.use(
      http.get(FOLDER_PARENTS_URL, () =>
        HttpResponse.json({
          items: [
            { name: 'root', title: 'Platform' },
            { name: 'folder-uid-1', title: 'Production' },
          ],
        })
      )
    );
  });

  describe('folder', () => {
    it('shows the folder path as chevron-separated titles rather than a slash-joined string', async () => {
      render(<DeletedRuleReviewDrawer kind="alert" rule={buildAlertRule()} onClose={jest.fn()} />);

      expect(await screen.findByText('Platform')).toBeInTheDocument();
      expect(screen.getByText('Production')).toBeInTheDocument();
      expect(screen.queryByText(/Platform \/ Production/)).not.toBeInTheDocument();
    });

    it('shows the folder UID when the folder lookup fails', async () => {
      server.use(http.get(FOLDER_PARENTS_URL, () => HttpResponse.json({ message: 'nope' }, { status: 404 })));

      render(<DeletedRuleReviewDrawer kind="alert" rule={buildAlertRule()} onClose={jest.fn()} />);

      expect(await screen.findByText('folder-uid-1')).toBeInTheDocument();
    });
  });

  describe('notification settings', () => {
    it('shows the contact point as a link with its group-by and timing overrides', async () => {
      const rule = buildAlertRule({
        notificationSettings: {
          type: 'SimplifiedRouting',
          receiver: 'oncall-pager',
          groupBy: ['alertname', 'cluster'],
          groupWait: '30s',
          groupInterval: '5m',
          repeatInterval: '4h',
          muteTimeIntervals: ['weekends'],
          activeTimeIntervals: ['business-hours'],
        },
      });

      render(<DeletedRuleReviewDrawer kind="alert" rule={rule} onClose={jest.fn()} />);

      expect(await screen.findByRole('link', { name: 'oncall-pager' })).toHaveAttribute(
        'href',
        expect.stringContaining('/alerting/notifications?search=oncall-pager&tab=contact_points')
      );
      expect(screen.getByText('Notification settings')).toBeInTheDocument();
      expect(screen.getByText('Group by').nextSibling).toHaveTextContent('alertname, cluster');
      expect(screen.getByText('Group wait').nextSibling).toHaveTextContent('30s');
      expect(screen.getByText('Group interval').nextSibling).toHaveTextContent('5m');
      expect(screen.getByText('Repeat interval').nextSibling).toHaveTextContent('4h');
      expect(screen.getByText('Mute timings').nextSibling).toHaveTextContent('weekends');
      expect(screen.getByText('Active timings').nextSibling).toHaveTextContent('business-hours');
    });

    it('omits overrides the rule did not set', async () => {
      const rule = buildAlertRule({ notificationSettings: { type: 'SimplifiedRouting', receiver: 'oncall-pager' } });

      render(<DeletedRuleReviewDrawer kind="alert" rule={rule} onClose={jest.fn()} />);

      expect(await screen.findByRole('link', { name: 'oncall-pager' })).toBeInTheDocument();
      expect(screen.queryByText('Group by')).not.toBeInTheDocument();
      expect(screen.queryByText('Group wait')).not.toBeInTheDocument();
      expect(screen.queryByText('Mute timings')).not.toBeInTheDocument();
    });

    it('shows the named notification policy instead of a contact point for policy routing', async () => {
      const rule = buildAlertRule({ notificationSettings: { type: 'NamedRoutingTree', routingTree: 'team-tree' } });

      render(<DeletedRuleReviewDrawer kind="alert" rule={rule} onClose={jest.fn()} />);

      expect(await screen.findByText('Notification policy')).toBeInTheDocument();
      expect(screen.getByText('team-tree')).toBeInTheDocument();
      expect(screen.queryByText('Contact point')).not.toBeInTheDocument();
    });

    it('shows no notification section when the rule had none', async () => {
      render(<DeletedRuleReviewDrawer kind="alert" rule={buildAlertRule()} onClose={jest.fn()} />);

      expect(await screen.findByText('Deleted alert rule')).toBeInTheDocument();
      expect(screen.queryByText('Notification settings')).not.toBeInTheDocument();
    });
  });

  describe('dashboard reference', () => {
    const DASHBOARD_DTO_URL = '/apis/dashboard.grafana.app/:version/namespaces/:namespace/dashboards/:uid/dto';

    beforeEach(() => {
      // The v1 dashboard fixtures are served through the legacy dashboard API, which new layouts would bypass.
      setTestFlags({ dashboardNewLayouts: false });
    });

    afterEach(() => {
      setTestFlags({});
    });

    it('links to the dashboard panel using the dashboard and panel titles', async () => {
      mockDashboardApi(server).dashboard(
        mockDashboardDto({
          uid: 'dash-1',
          title: 'Node overview',
          panels: [
            { id: 6, type: 'stat', title: 'Uptime' },
            { id: 7, type: 'timeseries', title: 'CPU usage' },
          ],
        })
      );
      const rule = buildAlertRule({ panelRef: { dashboardUID: 'dash-1', panelID: 7 } });

      render(<DeletedRuleReviewDrawer kind="alert" rule={rule} onClose={jest.fn()} />);

      expect(await screen.findByRole('link', { name: 'Node overview › CPU usage' })).toHaveAttribute(
        'href',
        '/d/dash-1?viewPanel=7'
      );
    });

    it('finds a panel nested in a collapsed row', async () => {
      mockDashboardApi(server).dashboard(
        mockDashboardDto({
          uid: 'dash-1',
          title: 'Node overview',
          panels: [
            {
              id: 1,
              type: 'row',
              title: 'Details',
              collapsed: true,
              panels: [{ id: 7, type: 'timeseries', title: 'Disk IO' }],
            },
          ],
        })
      );
      const rule = buildAlertRule({ panelRef: { dashboardUID: 'dash-1', panelID: 7 } });

      render(<DeletedRuleReviewDrawer kind="alert" rule={rule} onClose={jest.fn()} />);

      expect(await screen.findByRole('link', { name: 'Node overview › Disk IO' })).toBeInTheDocument();
    });

    it('resolves titles from a v2 dashboard', async () => {
      setTestFlags({ dashboardNewLayouts: true });
      server.use(
        http.get(DASHBOARD_DTO_URL, ({ params }) =>
          HttpResponse.json({
            apiVersion: 'dashboard.grafana.app/v2',
            kind: 'DashboardWithAccessInfo',
            metadata: { name: params.uid, generation: 1, creationTimestamp: '2024-01-01T00:00:00Z' },
            access: {},
            spec: {
              title: 'Node overview v2',
              elements: {
                'panel-7': {
                  kind: 'Panel',
                  spec: { id: 7, title: 'Memory usage', vizConfig: { group: 'timeseries' } },
                },
              },
            },
          })
        )
      );
      const rule = buildAlertRule({ panelRef: { dashboardUID: 'dash-1', panelID: 7 } });

      render(<DeletedRuleReviewDrawer kind="alert" rule={rule} onClose={jest.fn()} />);

      expect(await screen.findByRole('link', { name: 'Node overview v2 › Memory usage' })).toBeInTheDocument();
    });

    it('shows the dashboard title with the panel ID when the panel no longer exists', async () => {
      mockDashboardApi(server).dashboard(
        mockDashboardDto({ uid: 'dash-1', title: 'Node overview', panels: [{ id: 6, type: 'stat', title: 'Uptime' }] })
      );
      const rule = buildAlertRule({ panelRef: { dashboardUID: 'dash-1', panelID: 7 } });

      render(<DeletedRuleReviewDrawer kind="alert" rule={rule} onClose={jest.fn()} />);

      expect(await screen.findByRole('link', { name: 'Node overview › Panel 7' })).toHaveAttribute(
        'href',
        '/d/dash-1?viewPanel=7'
      );
    });

    it('shows the dashboard UID and panel ID when the dashboard cannot be loaded', async () => {
      // useDashboardQuery logs fetch failures instead of surfacing them.
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
      server.use(http.get(DASHBOARD_DTO_URL, () => HttpResponse.json({ message: 'not found' }, { status: 404 })));
      const rule = buildAlertRule({ panelRef: { dashboardUID: 'dash-1', panelID: 7 } });

      render(<DeletedRuleReviewDrawer kind="alert" rule={rule} onClose={jest.fn()} />);

      await waitFor(() => expect(consoleError).toHaveBeenCalledWith('Failed to fetch dashboard', expect.anything()));
      expect(screen.getByRole('link', { name: 'Dashboard dash-1, panel 7' })).toHaveAttribute(
        'href',
        '/d/dash-1?viewPanel=7'
      );
      consoleError.mockRestore();
    });

    it('shows no dashboard section when the rule was not linked to a panel', async () => {
      render(<DeletedRuleReviewDrawer kind="alert" rule={buildAlertRule()} onClose={jest.fn()} />);

      expect(await screen.findByText('Deleted alert rule')).toBeInTheDocument();
      expect(screen.queryByText('Dashboard panel')).not.toBeInTheDocument();
    });
  });

  describe('expressions and queries', () => {
    it('lists each Alert rule query with its ref ID, data source name, and query text, and each expression with its type', async () => {
      const rule = buildAlertRule({ expressions: QUERY_AND_MATH_EXPRESSIONS });

      render(<DeletedRuleReviewDrawer kind="alert" rule={rule} onClose={jest.fn()} />);

      expect(await screen.findByText('Data source: Prometheus')).toBeInTheDocument();
      expect(screen.getByText('sum(rate(cpu_seconds_total[5m]))')).toBeInTheDocument();
      expect(screen.getByText('Expression type: Math')).toBeInTheDocument();
      expect(screen.getByText('$A > 0.8')).toBeInTheDocument();
      expect(screen.getByText('A')).toBeInTheDocument();
      expect(screen.getByText('B')).toBeInTheDocument();
      expect(screen.getByText('Source')).toBeInTheDocument();
    });

    it('shows the same readable list for a Recording rule', async () => {
      const rule = buildRecordingRule({ expressions: QUERY_AND_MATH_EXPRESSIONS });

      render(<DeletedRuleReviewDrawer kind="recording" rule={rule} onClose={jest.fn()} />);

      expect(await screen.findByText('Data source: Prometheus')).toBeInTheDocument();
      expect(screen.getByText('sum(rate(cpu_seconds_total[5m]))')).toBeInTheDocument();
      expect(screen.getByText('Expression type: Math')).toBeInTheDocument();
      expect(screen.getByText('$A > 0.8')).toBeInTheDocument();
    });

    it('falls back to the data source UID and compact query JSON when neither resolves', async () => {
      const rule = buildAlertRule({
        expressions: {
          A: { datasourceUID: 'gone-uid', model: { refId: 'A', datasource: { uid: 'gone-uid' }, scenarioId: 'csv' } },
        },
      });

      render(<DeletedRuleReviewDrawer kind="alert" rule={rule} onClose={jest.fn()} />);

      expect(await screen.findByText('Data source: gone-uid')).toBeInTheDocument();
      expect(screen.getByText('{"scenarioId":"csv"}')).toBeInTheDocument();
    });

    it('keeps the sanitized Kubernetes JSON as the advanced view only', async () => {
      const rule = buildAlertRule({ expressions: QUERY_AND_MATH_EXPRESSIONS });

      const { user } = render(<DeletedRuleReviewDrawer kind="alert" rule={rule} onClose={jest.fn()} />);

      const drawer = await screen.findByRole('dialog');
      expect(within(drawer).queryByText(/apiVersion/)).not.toBeInTheDocument();
      await user.click(within(drawer).getByRole('button', { name: 'Advanced: Kubernetes JSON' }));
      expect(within(drawer).getByText(/apiVersion/)).toBeInTheDocument();
    });
  });
});
