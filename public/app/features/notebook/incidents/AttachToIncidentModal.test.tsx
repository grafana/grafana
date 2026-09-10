import { http, HttpResponse } from 'msw';
import { render, screen } from 'test/test-utils';

import { config, setBackendSrv } from '@grafana/runtime';
import server, { setupMockServer } from '@grafana/test-utils/server';
import { AppNotificationList } from 'app/core/components/AppNotifications/AppNotificationList';
import { backendSrv } from 'app/core/services/backend_srv';
import { type IncidentPreview } from 'app/features/alerting/unified/api/incidentsApi';
import { SupportedPlugin } from 'app/features/alerting/unified/types/pluginBridges';

import { AttachToIncidentModal } from './AttachToIncidentModal';

setBackendSrv(backendSrv);
setupMockServer();

const QUERY_PREVIEWS_PATH = '/api/plugins/:pluginId/resources/api/v1/IncidentsService.QueryIncidentPreviews';
const ADD_ACTIVITY_PATH = '/api/plugins/:pluginId/resources/api/v1/ActivityService.AddActivity';

const activeIncidents: IncidentPreview[] = [
  { incidentID: '101', title: 'Checkout 5xx spike', severityLabel: 'Critical', createdTime: '2026-09-10T10:00:00Z' },
  { incidentID: '102', title: 'Payments latency', severityLabel: 'Major', createdTime: '2026-09-10T09:00:00Z' },
];

function mockIncidents(incidents: IncidentPreview[]) {
  server.use(http.post(QUERY_PREVIEWS_PATH, () => HttpResponse.json({ incidentPreviews: incidents })));
}

/** Resolves with the body the modal posted, so the attach payload can be asserted on. */
function captureAttach(status = 200) {
  const posted: Array<Record<string, unknown>> = [];
  server.use(
    http.post(ADD_ACTIVITY_PATH, async ({ request }) => {
      posted.push(await request.json());
      return status === 200 ? HttpResponse.json({}) : new HttpResponse(null, { status });
    })
  );
  return posted;
}

function setup() {
  const onDismiss = jest.fn();
  const rendered = render(
    <>
      <AppNotificationList />
      <AttachToIncidentModal uid="nb1" title="PromQL query (4)" pluginId={SupportedPlugin.Irm} onDismiss={onDismiss} />
    </>
  );

  return { ...rendered, onDismiss };
}

describe('AttachToIncidentModal', () => {
  const originalAppUrl = config.appUrl;

  beforeEach(() => {
    config.appUrl = 'https://grafana.example/';
  });

  afterEach(() => {
    config.appUrl = originalAppUrl;
  });

  it('lists the active incidents with their severity', async () => {
    mockIncidents(activeIncidents);
    setup();

    expect(await screen.findByText('Checkout 5xx spike')).toBeInTheDocument();
    expect(screen.getByText('Payments latency')).toBeInTheDocument();
    expect(screen.getByText('Critical')).toBeInTheDocument();
  });

  // Nothing is chosen on open, so there is nothing to attach to yet.
  it('cannot be confirmed until an incident is chosen', async () => {
    mockIncidents(activeIncidents);
    const { user } = setup();

    expect(await screen.findByRole('button', { name: 'Attach' })).toBeDisabled();

    await user.click(screen.getByText('Checkout 5xx spike'));

    expect(screen.getByRole('button', { name: 'Attach' })).toBeEnabled();
  });

  // The URL is the whole point: Incident has no attachment method, so a link in the note body is
  // what becomes attached context on the incident.
  it('posts a note carrying the notebook title and its absolute url', async () => {
    mockIncidents(activeIncidents);
    const posted = captureAttach();
    const { user, onDismiss } = setup();

    await user.click(await screen.findByText('Payments latency'));
    await user.click(screen.getByRole('button', { name: 'Attach' }));

    await screen.findByText(/Notebook attached to "Payments latency"/);

    expect(posted).toHaveLength(1);
    expect(posted[0]).toEqual({
      incidentID: '102',
      activityKind: 'userNote',
      body: 'Notebook: PromQL query (4)\nhttps://grafana.example/notebooks/nb1',
    });
    expect(onDismiss).toHaveBeenCalled();
  });

  // Kept open on the same selection so it can be retried without picking again.
  it('stays open when the attach fails', async () => {
    mockIncidents(activeIncidents);
    captureAttach(500);
    const { user, onDismiss } = setup();

    await user.click(await screen.findByText('Payments latency'));
    await user.click(screen.getByRole('button', { name: 'Attach' }));

    expect(await screen.findByRole('button', { name: 'Attach' })).toBeInTheDocument();
    expect(onDismiss).not.toHaveBeenCalled();
  });

  // An empty list with a Cancel button would be a dead end, so it says so and offers the way out.
  it('offers declaring one when nothing is active', async () => {
    mockIncidents([]);
    setup();

    expect(await screen.findByText(/no active incidents/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Declare incident/ })).toHaveAttribute(
      'href',
      expect.stringContaining('/a/grafana-irm-app/incidents/declare')
    );
  });

  it('reports a failure to load the incidents', async () => {
    server.use(http.post(QUERY_PREVIEWS_PATH, () => new HttpResponse(null, { status: 403 })));
    setup();

    expect(await screen.findByText('Could not load incidents')).toBeInTheDocument();
  });
});
