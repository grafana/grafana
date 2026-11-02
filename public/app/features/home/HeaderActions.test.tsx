import { type RefObject } from 'react';
import { render, screen, waitFor, within } from 'test/test-utils';

import { setBackendSrv, setPluginComponentsHook } from '@grafana/runtime';
import { invalidateCachedPromisesCache } from '@grafana/runtime/internal';
import { setupMockServer } from '@grafana/test-utils/server';
import { backendSrv } from 'app/core/services/backend_srv';
import { contextSrv } from 'app/core/services/context_srv';
import { ACTIVE_INCIDENTS_QUERY_LIMIT } from 'app/features/alerting/unified/api/incidentsApi';
import { AccessControlAction } from 'app/types/accessControl';

import { ALERTS_TAB_ID, INCIDENTS_TAB_ID, type AlertIncidentSwitchHandle } from './AlertsIncidents/AlertIncidentTabs';
import {
  makeAlert,
  mockAlerts,
  mockIrmPlugin,
  mockNoIrmPlugin,
  mockTeams,
} from './AlertsIncidents/alertIncidentTabsTestUtils';
import { mockIncidents } from './AlertsIncidents/mockIncidentsApi';
import { useFiringAlerts } from './AlertsIncidents/useFiringAlerts';
import { useIncidents } from './AlertsIncidents/useIncidents';
import { HeaderActions } from './HeaderActions';
import { ctaClicked } from './analytics/main';

jest.mock('./analytics/main', () => ({
  ctaClicked: jest.fn(),
  tabChanged: jest.fn(),
  clearHistoryClicked: jest.fn(),
  homepageViewed: jest.fn(),
}));

setBackendSrv(backendSrv);
setupMockServer();

const noopRef = { current: null } satisfies RefObject<AlertIncidentSwitchHandle | null>;

function HeaderActionsWithData({
  switchRef = noopRef,
}: {
  switchRef?: RefObject<AlertIncidentSwitchHandle | null>;
} = {}) {
  const alertsData = useFiringAlerts();
  const incidentsData = useIncidents();
  return <HeaderActions alertsData={alertsData} incidentsData={incidentsData} alertIncidentRef={switchRef} />;
}

beforeEach(() => {
  setPluginComponentsHook(() => ({ components: [], isLoading: false }));
  jest
    .spyOn(contextSrv, 'hasPermission')
    .mockImplementation((action: string) => action === AccessControlAction.AlertingInstanceRead);
  mockTeams([]);
  mockAlerts([]);
  mockNoIrmPlugin();
});

afterEach(() => {
  jest.restoreAllMocks();
  invalidateCachedPromisesCache();
});

describe('HeaderActions', () => {
  it('renders nothing when the user lacks alerting permission and IRM is not installed', async () => {
    jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(false);

    const { container } = render(<HeaderActionsWithData />);
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it('shows "All clear" on the firing alerts button when there are no alerts', async () => {
    render(<HeaderActionsWithData />);
    const button = await screen.findByRole('button', { name: /firing alerts/i });
    await waitFor(() => expect(within(button).getByText('All clear')).toBeInTheDocument());
  });

  it('shows the total alert count on the firing alerts button', async () => {
    mockAlerts([
      makeAlert({ labels: { alertname: 'CPU Critical', severity: 'critical' } }),
      makeAlert({ labels: { alertname: 'Memory High', severity: 'high' } }),
      makeAlert({ labels: { alertname: 'Disk Warning', severity: 'warning' } }),
    ]);

    render(<HeaderActionsWithData />);

    const button = await screen.findByRole('button', { name: /firing alerts/i });
    await waitFor(() => expect(within(button).getByText('3')).toBeInTheDocument());
  });

  it('shows critical and high severity counts alongside SeverityBars', async () => {
    mockAlerts([
      makeAlert({ labels: { alertname: 'CPU Critical', severity: 'critical' } }),
      makeAlert({ labels: { alertname: 'Memory High', severity: 'high' } }),
    ]);

    render(<HeaderActionsWithData />);

    const button = await screen.findByRole('button', { name: /firing alerts/i });
    await waitFor(() => {
      // Total count
      expect(within(button).getByText('2')).toBeInTheDocument();
      // One count per severity level (critical=1, high=1)
      expect(within(button).getAllByText('1')).toHaveLength(2);
    });
  });

  it('does not render the incidents button when IRM is not installed', async () => {
    render(<HeaderActionsWithData />);

    await screen.findByRole('button', { name: /firing alerts/i });
    // IRM plugin bridge settles asynchronously; give it time before asserting absence
    await waitFor(() => expect(screen.queryByRole('button', { name: /active incidents/i })).not.toBeInTheDocument());
  });

  it('shows "All clear" on the incidents button when there are no active incidents', async () => {
    mockIrmPlugin();
    mockIncidents([]);

    render(<HeaderActionsWithData />);

    const button = await screen.findByRole('button', { name: /active incidents/i });
    await waitFor(() => expect(within(button).getByText('All clear')).toBeInTheDocument());
  });

  it('shows the active incident count on the incidents button', async () => {
    mockIrmPlugin();
    mockIncidents([
      { incidentID: '1', title: 'Database outage', severityLabel: 'Critical', createdTime: '2024-01-02T10:00:00Z' },
      { incidentID: '2', title: 'Elevated latency', severityLabel: 'High', createdTime: '2024-01-01T09:00:00Z' },
    ]);

    render(<HeaderActionsWithData />);

    const button = await screen.findByRole('button', { name: /active incidents/i });
    await waitFor(() => expect(within(button).getByText('2')).toBeInTheDocument());
  });

  it("shows 'N+' on the incidents button when the server reports more incidents beyond the query limit", async () => {
    jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(false);
    mockIrmPlugin();
    mockIncidents(
      Array.from({ length: ACTIVE_INCIDENTS_QUERY_LIMIT }, (_, i) => ({
        incidentID: String(i),
        title: `Incident ${i}`,
        severityLabel: 'Critical',
        createdTime: '2024-01-02T10:00:00Z',
      })),
      { hasMore: true }
    );

    render(<HeaderActionsWithData />);

    const button = await screen.findByRole('button', { name: /active incidents/i });
    await waitFor(() => expect(within(button).getByText(`${ACTIVE_INCIDENTS_QUERY_LIMIT}+`)).toBeInTheDocument());
  });

  it('clicking the firing alerts button switches to the alerts tab', async () => {
    const switchFn = jest.fn();

    const { user } = render(<HeaderActionsWithData switchRef={{ current: { switch: switchFn } }} />);

    await user.click(await screen.findByRole('button', { name: /firing alerts/i }));
    expect(switchFn).toHaveBeenCalledWith(ALERTS_TAB_ID);
    expect(ctaClicked).toHaveBeenCalledWith({
      surface: 'header',
      action: 'view_alerts',
      placement: 'pill',
    });
  });

  it('clicking the incidents button switches to the incidents tab', async () => {
    mockIrmPlugin();
    mockIncidents([]);
    const switchFn = jest.fn();

    const { user } = render(<HeaderActionsWithData switchRef={{ current: { switch: switchFn } }} />);

    await user.click(await screen.findByRole('button', { name: /active incidents/i }));
    expect(switchFn).toHaveBeenCalledWith(INCIDENTS_TAB_ID);
    expect(ctaClicked).toHaveBeenCalledWith({
      surface: 'header',
      action: 'view_incidents',
      placement: 'pill',
    });
  });
});
