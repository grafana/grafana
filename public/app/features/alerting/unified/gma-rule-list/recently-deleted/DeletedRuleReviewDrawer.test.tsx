import { HttpResponse, http } from 'msw';
import { render, screen, within } from 'test/test-utils';

import { getAPIBaseURL } from '@grafana/api-clients';
import { type AlertRule, type RecordingRule } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { setBackendSrv } from '@grafana/runtime';
import server, { setupMockServer } from '@grafana/test-utils/server';
import { backendSrv } from 'app/core/services/backend_srv';
import { mockDataSource } from 'app/features/alerting/unified/mocks';
import { setupDataSources } from 'app/features/alerting/unified/testSetup/datasources';
import { DataSourceType } from 'app/features/alerting/unified/utils/datasource';

import { DeletedRuleReviewDrawer } from './DeletedRuleReviewDrawer';

const FOLDER_PARENTS_URL = `${getAPIBaseURL('folder.grafana.app', 'v1beta1')}/folders/:name/parents`;

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
    it('links to the dashboard panel with a readable label', async () => {
      const rule = buildAlertRule({ panelRef: { dashboardUID: 'dash-1', panelID: 7 } });

      render(<DeletedRuleReviewDrawer kind="alert" rule={rule} onClose={jest.fn()} />);

      expect(await screen.findByRole('link', { name: 'Dashboard dash-1, panel 7' })).toHaveAttribute(
        'href',
        '/d/dash-1?viewPanel=7'
      );
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
