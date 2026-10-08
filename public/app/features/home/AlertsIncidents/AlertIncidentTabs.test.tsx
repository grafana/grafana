import { act, render, screen, waitFor } from 'test/test-utils';

import { PluginIncludeType } from '@grafana/data';
import { contextSrv } from 'app/core/services/context_srv';
import { ACTIVE_INCIDENTS_QUERY_LIMIT, type IncidentPreview } from 'app/features/alerting/unified/api/incidentsApi';

import { ALERTS_TAB_ID, INCIDENTS_TAB_ID, type AlertIncidentSwitchHandle } from './AlertIncidentTabs';
import {
  AlertIncidentTabsWithData,
  activeIncident,
  makeAlert,
  mockAlerts,
  mockIrmPlugin,
  setupAlertIncidentTabsTests,
} from './alertIncidentTabsTestSetup';
import { mockIncidents } from './mockIncidentsApi';

jest.mock('../analytics/main', () => ({
  ctaClicked: jest.fn(),
  tabChanged: jest.fn(),
  clearHistoryClicked: jest.fn(),
  homepageViewed: jest.fn(),
}));

jest.mock('app/core/services/context_srv', () => ({
  contextSrv: {
    ...jest.requireActual('app/core/services/context_srv').contextSrv,
    hasPermission: jest.fn(),
    isSignedIn: true,
  },
}));

setupAlertIncidentTabsTests();

describe('AlertIncidentTabs', () => {
  it('renders nothing when the user lacks AlertingInstanceRead permission', async () => {
    jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(false);

    const { container } = render(<AlertIncidentTabsWithData />);
    // the plugin bridge settles asynchronously, so let it before asserting nothing appeared
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it('renders a single Firing alerts heading and tab when permitted', async () => {
    mockAlerts([makeAlert({ labels: { alertname: 'CPU Critical', severity: 'critical' } })]);

    render(<AlertIncidentTabsWithData />);

    // Wait for the alert to load so the card content is rendered.
    expect(await screen.findByText('CPU Critical')).toBeInTheDocument();
    // In the redesign the inner card header is hidden, so only the section heading remains.
    // The Incident plugin is absent here, so the heading drops the "& incidents" half.
    expect(screen.getByRole('heading', { name: 'Alerts' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /firing alerts/i })).toBeInTheDocument();
    // The severity breakdown badge lives in the card header, which the redesign hides.
    expect(screen.queryByText(/1 critical/i)).not.toBeInTheDocument();
  });

  it('shows a tab counter reflecting the number of firing alerts', async () => {
    mockAlerts([
      makeAlert({ labels: { alertname: 'CPU Critical', severity: 'critical' } }),
      makeAlert({ labels: { alertname: 'Memory High', severity: 'high' } }),
    ]);

    render(<AlertIncidentTabsWithData />);

    // Counter is undefined while loading, so wait until it reflects the loaded count.
    const tab = await screen.findByRole('tab', { name: /firing alerts/i });
    await waitFor(() => expect(tab).toHaveTextContent('2'));
  });

  it("shows '50+' on the Incidents tab counter when the server reports more incidents beyond the query limit", async () => {
    jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(false);
    mockIrmPlugin();
    const fullPage: IncidentPreview[] = Array.from({ length: ACTIVE_INCIDENTS_QUERY_LIMIT }, (_, i) => ({
      incidentID: String(i),
      title: `Incident ${i}`,
      severityLabel: 'Critical',
      createdTime: '2024-01-02T10:00:00Z',
    }));
    mockIncidents(fullPage, { hasMore: true });

    render(<AlertIncidentTabsWithData />);

    const tab = await screen.findByRole('tab', { name: /incidents/i });
    await waitFor(() => expect(tab).toHaveTextContent(`${ACTIVE_INCIDENTS_QUERY_LIMIT}+`));
  });

  it('shows the exact count on the Incidents tab counter when a full page has nothing beyond it', async () => {
    jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(false);
    mockIrmPlugin();
    const fullPage: IncidentPreview[] = Array.from({ length: ACTIVE_INCIDENTS_QUERY_LIMIT }, (_, i) => ({
      incidentID: String(i),
      title: `Incident ${i}`,
      severityLabel: 'Critical',
      createdTime: '2024-01-02T10:00:00Z',
    }));
    mockIncidents(fullPage, { hasMore: false });

    render(<AlertIncidentTabsWithData />);

    const tab = await screen.findByRole('tab', { name: /incidents/i });
    await waitFor(() => expect(tab).toHaveTextContent(String(ACTIVE_INCIDENTS_QUERY_LIMIT)));
    expect(tab).not.toHaveTextContent(`${ACTIVE_INCIDENTS_QUERY_LIMIT}+`);
  });

  it('defaults to the Incidents tab for a user without alerting permission when the plugin is installed', async () => {
    jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(false);
    mockIrmPlugin();
    mockIncidents([activeIncident]);

    render(<AlertIncidentTabsWithData />);

    expect(await screen.findByText('Database outage')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /incidents/i })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('heading', { name: 'Incidents' })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /firing alerts/i })).not.toBeInTheDocument();
  });

  it('switches to the Incidents tab and renders incident content', async () => {
    mockAlerts([makeAlert({ labels: { alertname: 'CPU Critical', severity: 'critical' } })]);
    mockIrmPlugin();
    mockIncidents([activeIncident]);

    const { user } = render(<AlertIncidentTabsWithData />);

    // Alerts tab is active by default.
    expect(await screen.findByText('CPU Critical')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Alerts & incidents' })).toBeInTheDocument();

    await user.click(await screen.findByRole('tab', { name: /incidents/i }));

    expect(await screen.findByText('Database outage')).toBeInTheDocument();
    expect(screen.queryByText('CPU Critical')).not.toBeInTheDocument();
  });

  it('switchRef handle switches tabs imperatively', async () => {
    mockAlerts([makeAlert({ labels: { alertname: 'CPU Critical', severity: 'critical' } })]);
    mockIrmPlugin();
    mockIncidents([activeIncident]);
    let handle: AlertIncidentSwitchHandle | null = null;

    render(
      <AlertIncidentTabsWithData
        switchRef={(instance) => {
          handle = instance;
        }}
      />
    );

    expect(await screen.findByText('CPU Critical')).toBeInTheDocument();
    expect(handle).not.toBeNull();

    await act(async () => {
      handle?.switch(INCIDENTS_TAB_ID, false);
    });

    expect(await screen.findByText('Database outage')).toBeInTheDocument();
    expect(screen.queryByText('CPU Critical')).not.toBeInTheDocument();

    await act(async () => {
      handle?.switch(ALERTS_TAB_ID, false);
    });

    expect(await screen.findByText('CPU Critical')).toBeInTheDocument();
    expect(screen.queryByText('Database outage')).not.toBeInTheDocument();
  });

  it('switchRef handle scrolls by default and skips scrolling when requested', async () => {
    mockAlerts([makeAlert({ labels: { alertname: 'CPU Critical', severity: 'critical' } })]);
    mockIrmPlugin();
    mockIncidents([activeIncident]);
    let handle: AlertIncidentSwitchHandle | null = null;
    const scrollIntoView = jest.fn();
    // Patch HTMLElement.prototype (not Element.prototype) to match the rest of the codebase's convention
    // and the shared jest-setup.ts default it shadows - Element.prototype sits further up the prototype
    // chain, so a real DOM node would resolve scrollIntoView via HTMLElement.prototype first regardless.
    const originalScrollIntoView = window.HTMLElement.prototype.scrollIntoView;
    window.HTMLElement.prototype.scrollIntoView = scrollIntoView;

    try {
      render(
        <AlertIncidentTabsWithData
          switchRef={(instance) => {
            handle = instance;
          }}
        />
      );

      expect(await screen.findByText('CPU Critical')).toBeInTheDocument();

      await act(async () => {
        handle?.switch(INCIDENTS_TAB_ID);
      });

      expect(await screen.findByText('Database outage')).toBeInTheDocument();
      expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth' });

      scrollIntoView.mockClear();

      await act(async () => {
        handle?.switch(ALERTS_TAB_ID, false);
      });

      expect(await screen.findByText('CPU Critical')).toBeInTheDocument();
      expect(scrollIntoView).not.toHaveBeenCalled();
    } finally {
      window.HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
    }
  });

  it('shows the incidents footer actions when the user can declare and access incidents', async () => {
    jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(false);
    // No page includes to gate on, so canDeclare/canAccess both resolve to true.
    mockIrmPlugin({ includes: [] });
    mockIncidents([activeIncident]);

    render(<AlertIncidentTabsWithData />);

    expect(await screen.findByText('Database outage')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /declare an incident/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /view all incidents/i })).toBeInTheDocument();
  });

  it('hides the incidents footer actions when the user lacks the plugin page permissions', async () => {
    jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(false);
    mockIrmPlugin({
      includes: [
        {
          type: PluginIncludeType.page,
          name: 'Incidents',
          path: '/a/grafana-irm-app/incidents',
          action: 'grafana-irm-app.incidents:read',
        },
        {
          type: PluginIncludeType.page,
          name: 'Declare incident',
          path: '/a/grafana-irm-app/incidents/declare',
          action: 'grafana-irm-app.incidents:write',
        },
      ],
    });
    mockIncidents([activeIncident]);

    render(<AlertIncidentTabsWithData />);

    expect(await screen.findByText('Database outage')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /declare an incident/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /view all incidents/i })).not.toBeInTheDocument();
  });
});
