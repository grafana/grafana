import { http, HttpResponse } from 'msw';
import { render, screen, waitFor } from 'test/test-utils';

import { setBackendSrv, setPluginComponentsHook } from '@grafana/runtime';
import server, { setupMockServer } from '@grafana/test-utils/server';
import { backendSrv } from 'app/core/services/backend_srv';
import { SupportedPlugin } from 'app/features/alerting/unified/types/pluginBridges';

import { ActiveIncidentsCard } from './ActiveIncidentsCard';

setBackendSrv(backendSrv);
setupMockServer();

function mockPluginInstalled(pluginId: string, installed: boolean) {
  server.use(
    http.get(`/api/plugins/${pluginId}/settings`, () => {
      if (!installed) {
        return HttpResponse.json({ message: 'Plugin not found' }, { status: 404 });
      }
      return HttpResponse.json({
        id: pluginId,
        type: 'app',
        enabled: true,
        info: { version: '1.0.0', author: { name: 'Grafana Labs' }, logos: { large: '', small: '' }, links: [] },
      });
    })
  );
}

function mockIncidentsResponse(pluginId: string, incidents: object[]) {
  server.use(
    http.post(`/api/plugins/${pluginId}/resources/api/v1/IncidentsService.QueryIncidents`, () =>
      HttpResponse.json({ incidents, cursor: { hasMore: false, nextValue: '' } })
    )
  );
}

const sampleIncidents = [
  {
    incidentID: 'inc-1',
    title: 'Database outage',
    severity: 'critical',
    status: 'active',
    createdTime: new Date(Date.now() - 120_000).toISOString(),
    createdByUser: { name: 'Alice' },
  },
  {
    incidentID: 'inc-2',
    title: 'Slow queries',
    severity: 'minor',
    status: 'active',
    createdTime: new Date(Date.now() - 60_000).toISOString(),
    createdByUser: { name: 'Bob' },
  },
];

beforeEach(() => {
  setPluginComponentsHook(() => ({ components: [], isLoading: false }));
  // Default: both IRM and incident-app not installed
  mockPluginInstalled(SupportedPlugin.Irm, false);
  mockPluginInstalled(SupportedPlugin.Incident, false);
});

describe('ActiveIncidentsCard', () => {
  it('renders null when neither IRM nor incident plugin is installed', async () => {
    const { container } = render(<ActiveIncidentsCard />);

    // Wait for the plugin settings to resolve
    await waitFor(() => {
      expect(container.querySelector('.react-loading-skeleton')).not.toBeInTheDocument();
    });

    expect(container).toBeEmptyDOMElement();
  });

  it('renders incidents when incident plugin is installed', async () => {
    const pluginId = SupportedPlugin.Incident;
    mockPluginInstalled(pluginId, true);
    mockIncidentsResponse(pluginId, sampleIncidents);

    render(<ActiveIncidentsCard />);

    await waitFor(() => {
      expect(screen.getByText('Database outage')).toBeInTheDocument();
    });

    expect(screen.getByText('Slow queries')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Active incidents')).toBeInTheDocument();
  });

  it('renders incidents when IRM plugin is installed', async () => {
    const pluginId = SupportedPlugin.Irm;
    mockPluginInstalled(pluginId, true);
    mockIncidentsResponse(pluginId, sampleIncidents);

    render(<ActiveIncidentsCard />);

    await waitFor(() => {
      expect(screen.getByText('Database outage')).toBeInTheDocument();
    });
  });

  it('shows empty state when no active incidents', async () => {
    const pluginId = SupportedPlugin.Incident;
    mockPluginInstalled(pluginId, true);
    mockIncidentsResponse(pluginId, []);

    render(<ActiveIncidentsCard />);

    await waitFor(() => {
      expect(screen.getByText('No active incidents.')).toBeInTheDocument();
    });
  });
});
