import { http, HttpResponse } from 'msw';
import { render, screen } from 'test/test-utils';

import { PluginIncludeType } from '@grafana/data';
import { setBackendSrv, setPluginComponentsHook } from '@grafana/runtime';
import server, { setupMockServer } from '@grafana/test-utils/server';
import { interceptLinkClicks } from 'app/core/navigation/patch/interceptLinkClicks';
import { backendSrv } from 'app/core/services/backend_srv';
import { contextSrv } from 'app/core/services/context_srv';
import { ACTIVE_INCIDENTS_QUERY_LIMIT, type IncidentPreview } from 'app/features/alerting/unified/api/incidentsApi';
import { useIrmPlugin } from 'app/features/alerting/unified/hooks/usePluginBridge';
import { pluginMeta } from 'app/features/alerting/unified/testSetup/plugins';
import { SupportedPlugin } from 'app/features/alerting/unified/types/pluginBridges';
import { configureStore } from 'app/store/configureStore';

import { ctaClicked } from '../analytics/main';

import { IncidentsCard } from './IncidentsCard';

jest.mock('app/features/alerting/unified/hooks/usePluginBridge', () => ({
  ...jest.requireActual('app/features/alerting/unified/hooks/usePluginBridge'),
  useIrmPlugin: jest.fn(),
}));
jest.mock('../analytics/main', () => ({
  ctaClicked: jest.fn(),
  tabChanged: jest.fn(),
  clearHistoryClicked: jest.fn(),
  homepageViewed: jest.fn(),
}));

setBackendSrv(backendSrv);
setupMockServer();

const mockUseIrmPlugin = jest.mocked(useIrmPlugin);

const QUERY_PREVIEWS_PATH = '/api/plugins/:pluginId/resources/api/v1/IncidentsService.QueryIncidentPreviews';

const activeIncidents: IncidentPreview[] = [
  {
    incidentID: '101',
    title: 'Database outage',
    severityLabel: 'Critical',
    createdTime: '2024-01-02T10:00:00Z',
  },
  {
    incidentID: '102',
    title: 'Elevated latency',
    severityLabel: 'Pending',
    createdTime: '2024-01-01T09:00:00Z',
  },
];

function mockIncidents(incidents: IncidentPreview[], { hasMore = false } = {}) {
  server.use(
    http.post(QUERY_PREVIEWS_PATH, () =>
      HttpResponse.json({ incidentPreviews: incidents, cursor: { hasMore, nextValue: hasMore ? 'next' : '' } })
    )
  );
}

beforeEach(() => {
  setPluginComponentsHook(() => ({ components: [], isLoading: false }));
  // Default: plugin installed. Individual tests override availability as needed.
  mockUseIrmPlugin.mockReturnValue({
    pluginId: SupportedPlugin.Incident,
    installed: true,
    loading: false,
    settings: { ...pluginMeta[SupportedPlugin.Incident], includes: [] },
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('IncidentsCard', () => {
  it('lists active incidents with severity, count badge, and detail links', async () => {
    mockIncidents(activeIncidents);

    render(<IncidentsCard />);

    expect(await screen.findByText('Database outage')).toBeInTheDocument();
    expect(screen.getByText('Elevated latency')).toBeInTheDocument();

    // Severity labels surface verbatim as badges; live labels are capitalized and org-configurable
    expect(screen.getByText('Critical')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();

    // Header count badge reflects the total number of active incidents
    expect(screen.getByText('2')).toBeInTheDocument();

    // Detail link is keyed by incidentID, routed through the plugin bridge
    expect(screen.getByRole('link', { name: 'Database outage' })).toHaveAttribute(
      'href',
      '/a/grafana-incident-app/incidents/101'
    );

    // Populated card footer shows both the declare action and the view-all link.
    expect(screen.getByRole('link', { name: /view all incidents/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /declare an incident/i })).toBeInTheDocument();
  });

  it('shows the declare CTA in the empty state', async () => {
    mockIncidents([]);

    render(<IncidentsCard />);

    expect(await screen.findByRole('link', { name: /declare an incident/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Database outage' })).not.toBeInTheDocument();
  });

  it('treats a 404 (org not onboarded) as the empty state, not an error', async () => {
    server.use(http.post(QUERY_PREVIEWS_PATH, () => new HttpResponse(null, { status: 404 })));

    render(<IncidentsCard />);

    expect(await screen.findByRole('link', { name: /declare an incident/i })).toBeInTheDocument();
    expect(screen.queryByText('Could not load active incidents')).not.toBeInTheDocument();
  });

  it('shows a retryable error for genuine failures (5xx)', async () => {
    server.use(http.post(QUERY_PREVIEWS_PATH, () => new HttpResponse(null, { status: 500 })));

    render(<IncidentsCard />);

    expect(await screen.findByText('Could not load active incidents')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    expect(screen.queryByText('No active incidents.')).not.toBeInTheDocument();
  });

  it('renders incident titles as plain text when the user cannot access the incidents page', async () => {
    jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(false);
    mockUseIrmPlugin.mockReturnValue({
      pluginId: SupportedPlugin.Incident,
      installed: true,
      loading: false,
      settings: {
        ...pluginMeta[SupportedPlugin.Incident],
        includes: [
          {
            type: PluginIncludeType.page,
            name: 'Incidents',
            path: '/a/grafana-incident-app/incidents',
            action: 'grafana-incident-app.incidents:read',
          },
        ],
      },
    });
    mockIncidents(activeIncidents);

    render(<IncidentsCard />);

    expect(await screen.findByText('Database outage')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Database outage' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /view all incidents/i })).not.toBeInTheDocument();
  });

  it("count badge reads '50+' when the server reports more incidents beyond the query limit", async () => {
    const many: IncidentPreview[] = Array.from({ length: ACTIVE_INCIDENTS_QUERY_LIMIT }, (_, i) => ({
      incidentID: String(i),
      title: `Incident ${i}`,
      severityLabel: 'Critical',
      createdTime: '2024-01-02T10:00:00Z',
    }));
    mockIncidents(many, { hasMore: true });

    render(<IncidentsCard />);

    expect(await screen.findByText(`${ACTIVE_INCIDENTS_QUERY_LIMIT}+`)).toBeInTheDocument();
  });

  it('count badge reads the exact count when a full page has nothing beyond it', async () => {
    const many: IncidentPreview[] = Array.from({ length: ACTIVE_INCIDENTS_QUERY_LIMIT }, (_, i) => ({
      incidentID: String(i),
      title: `Incident ${i}`,
      severityLabel: 'Critical',
      createdTime: '2024-01-02T10:00:00Z',
    }));
    mockIncidents(many, { hasMore: false });

    render(<IncidentsCard />);

    expect(await screen.findByText(String(ACTIVE_INCIDENTS_QUERY_LIMIT))).toBeInTheDocument();
    expect(screen.queryByText(`${ACTIVE_INCIDENTS_QUERY_LIMIT}+`)).not.toBeInTheDocument();
  });

  it('renders more than five active incidents (display cap raised to 50)', async () => {
    const many: IncidentPreview[] = Array.from({ length: 8 }, (_, i) => ({
      incidentID: String(i),
      title: `Incident ${i}`,
      severityLabel: 'Critical',
      createdTime: '2024-01-02T10:00:00Z',
    }));
    mockIncidents(many);

    render(<IncidentsCard />);

    expect(await screen.findByText('Incident 0')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(8);
  });

  it('shows a Declare CTA in the empty state when the user can declare', async () => {
    mockIncidents([]);

    render(<IncidentsCard />);

    expect(await screen.findByRole('link', { name: /declare an incident/i })).toHaveAttribute(
      'href',
      '/a/grafana-incident-app/incidents?declare=new'
    );
    expect(screen.getByRole('link', { name: /view all incidents/i })).toBeInTheDocument();
  });

  it('hides the Declare CTA when the user cannot declare incidents', async () => {
    jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(false);
    mockUseIrmPlugin.mockReturnValue({
      pluginId: SupportedPlugin.Incident,
      installed: true,
      loading: false,
      settings: {
        ...pluginMeta[SupportedPlugin.Incident],
        includes: [
          {
            type: PluginIncludeType.page,
            name: 'Declare',
            path: '/a/grafana-incident-app/incidents/declare',
            action: 'grafana-incident-app.incidents:write',
          },
        ],
      },
    });
    mockIncidents([]);

    render(<IncidentsCard />);

    expect(await screen.findByText('No active incidents.')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /declare an incident/i })).not.toBeInTheDocument();
  });

  it('orders incidents by most recent created time', async () => {
    mockIncidents([
      {
        incidentID: '201',
        title: 'Critical but older',
        severityLabel: 'Critical',
        createdTime: '2024-01-01T00:00:00Z',
      },
      {
        incidentID: '202',
        title: 'Warning but newer',
        severityLabel: 'Warning',
        createdTime: '2024-01-02T00:00:00Z',
      },
    ]);

    render(<IncidentsCard />);

    expect(await screen.findByText('Warning but newer')).toBeInTheDocument();

    expect(screen.getAllByRole('listitem')[0]).toHaveTextContent('Warning but newer');
  });

  it('refetches active incidents on remount so a newly declared incident appears without a page refresh', async () => {
    // A shared store persists the RTK Query cache across unmount/remount, exactly like
    // navigating away from Home to declare an incident and back.
    const store = configureStore();
    mockIncidents([]);

    const { unmount } = render(<IncidentsCard />, { store });
    // The declare CTA only renders once the first query resolves as empty (not while loading).
    expect(await screen.findByRole('link', { name: /declare an incident/i })).toBeInTheDocument();

    unmount();

    // Incident declared out-of-band in the IRM plugin; user returns to Home (card remounts).
    mockIncidents([activeIncidents[0]]);
    render(<IncidentsCard />, { store });

    // refetchOnMountOrArgChange forces a refetch on remount; without it the stale empty
    // cache would persist and this assertion would time out.
    expect(await screen.findByText('Database outage')).toBeInTheDocument();
  });

  describe('analytics', () => {
    // LinkButton renders a plain <a href>; clicking it would trigger a real jsdom
    // navigation (console.error -> jest-fail-on-console). Route anchor clicks through
    // the SPA history the way the app does so the onClick fires without navigating.
    beforeEach(() => {
      document.addEventListener('click', interceptLinkClicks);
    });

    afterEach(() => {
      document.removeEventListener('click', interceptLinkClicks);
    });

    it('tracks incident_detail when an incident title link is clicked', async () => {
      mockIncidents(activeIncidents);

      const { user } = render(<IncidentsCard />);

      await user.click(await screen.findByRole('link', { name: 'Database outage' }));

      expect(jest.mocked(ctaClicked)).toHaveBeenCalledWith({
        surface: 'incidents_card',
        action: 'incident_detail',
        placement: 'list',
      });
    });

    it('tracks declare_incident from the empty-state CTA', async () => {
      mockIncidents([]);

      const { user } = render(<IncidentsCard />);

      await user.click(await screen.findByRole('link', { name: /declare an incident/i }));

      expect(jest.mocked(ctaClicked)).toHaveBeenCalledWith({
        surface: 'incidents_card',
        action: 'declare_incident',
        placement: 'empty_state',
      });
    });

    it('tracks declare_incident from the footer when incidents exist', async () => {
      mockIncidents(activeIncidents);

      const { user } = render(<IncidentsCard />);

      await user.click(await screen.findByRole('link', { name: /declare an incident/i }));

      expect(jest.mocked(ctaClicked)).toHaveBeenCalledWith({
        surface: 'incidents_card',
        action: 'declare_incident',
        placement: 'footer',
      });
    });

    it('tracks view_all_incidents from the footer', async () => {
      mockIncidents(activeIncidents);

      const { user } = render(<IncidentsCard />);

      await user.click(await screen.findByRole('link', { name: /view all incidents/i }));

      expect(jest.mocked(ctaClicked)).toHaveBeenCalledWith({
        surface: 'incidents_card',
        action: 'view_all_incidents',
        placement: 'footer',
      });
    });
  });
});
