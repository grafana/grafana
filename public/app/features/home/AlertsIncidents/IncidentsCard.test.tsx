import { http, HttpResponse } from 'msw';
import { render, screen } from 'test/test-utils';

import { setBackendSrv, setPluginComponentsHook } from '@grafana/runtime';
import server, { setupMockServer } from '@grafana/test-utils/server';
import { backendSrv } from 'app/core/services/backend_srv';
import { type IncidentPreview } from 'app/features/alerting/unified/api/incidentsApi';
import { useIrmPlugin } from 'app/features/alerting/unified/hooks/usePluginBridge';
import { SupportedPlugin } from 'app/features/alerting/unified/types/pluginBridges';

import { IncidentsCard } from './IncidentsCard';

jest.mock('app/features/alerting/unified/hooks/usePluginBridge');

setBackendSrv(backendSrv);
setupMockServer();

const mockUseIrmPlugin = jest.mocked(useIrmPlugin);

const QUERY_PREVIEWS_PATH = '/api/plugins/:pluginId/resources/api/v1/IncidentsService.QueryIncidentPreviews';

const activeIncidents: IncidentPreview[] = [
  {
    incidentID: '101',
    title: 'Database outage',
    slug: 'database-outage',
    status: 'active',
    severityLabel: 'Critical',
    isDrill: false,
    createdTime: '2024-01-02T10:00:00Z',
    incidentStart: '2024-01-02T10:00:00Z',
  },
  {
    incidentID: '102',
    title: 'Elevated latency',
    slug: 'elevated-latency',
    status: 'active',
    severityLabel: 'Pending',
    isDrill: false,
    createdTime: '2024-01-01T09:00:00Z',
    incidentStart: '2024-01-01T09:00:00Z',
  },
];

function mockIncidents(incidents: IncidentPreview[]) {
  server.use(http.post(QUERY_PREVIEWS_PATH, () => HttpResponse.json({ incidentPreviews: incidents })));
}

beforeEach(() => {
  setPluginComponentsHook(() => ({ components: [], isLoading: false }));
  // Default: plugin installed. Individual tests override availability as needed.
  mockUseIrmPlugin.mockReturnValue({ pluginId: SupportedPlugin.Incident, installed: true, loading: false });
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('IncidentsCard', () => {
  it('renders nothing when the Incident plugin is not installed', () => {
    mockUseIrmPlugin.mockReturnValue({ pluginId: SupportedPlugin.Incident, installed: false, loading: false });

    const { container } = render(<IncidentsCard />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing while the plugin availability is still loading', () => {
    mockUseIrmPlugin.mockReturnValue({ pluginId: SupportedPlugin.Incident, installed: undefined, loading: true });

    const { container } = render(<IncidentsCard />);
    expect(container).toBeEmptyDOMElement();
  });

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
  });

  it('shows the empty state when there are no active incidents', async () => {
    mockIncidents([]);

    render(<IncidentsCard />);

    expect(await screen.findByText('No active incidents.')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Database outage' })).not.toBeInTheDocument();
  });

  it('treats a 404 (org not onboarded) as the empty state, not an error', async () => {
    server.use(http.post(QUERY_PREVIEWS_PATH, () => new HttpResponse(null, { status: 404 })));

    render(<IncidentsCard />);

    expect(await screen.findByText('No active incidents.')).toBeInTheDocument();
    expect(screen.queryByText('Could not load active incidents')).not.toBeInTheDocument();
  });

  it('shows a retryable error for genuine failures (5xx)', async () => {
    server.use(http.post(QUERY_PREVIEWS_PATH, () => new HttpResponse(null, { status: 500 })));

    render(<IncidentsCard />);

    expect(await screen.findByText('Could not load active incidents')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    expect(screen.queryByText('No active incidents.')).not.toBeInTheDocument();
  });
});
