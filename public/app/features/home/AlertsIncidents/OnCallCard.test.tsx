import { http, HttpResponse } from 'msw';
import { render, screen } from 'test/test-utils';

import { PluginIncludeType } from '@grafana/data';
import { setBackendSrv, setPluginComponentsHook } from '@grafana/runtime';
import server, { setupMockServer } from '@grafana/test-utils/server';
import { backendSrv } from 'app/core/services/backend_srv';
import { contextSrv } from 'app/core/services/context_srv';
import { type OnCallSchedule } from 'app/features/alerting/unified/api/onCallApi';
import { useIrmPlugin } from 'app/features/alerting/unified/hooks/usePluginBridge';
import { pluginMeta } from 'app/features/alerting/unified/testSetup/plugins';
import { SupportedPlugin } from 'app/features/alerting/unified/types/pluginBridges';

import { OnCallCard } from './OnCallCard';

jest.mock('app/features/alerting/unified/hooks/usePluginBridge', () => ({
  ...jest.requireActual('app/features/alerting/unified/hooks/usePluginBridge'),
  useIrmPlugin: jest.fn(),
}));

setBackendSrv(backendSrv);
setupMockServer();

const mockUseIrmPlugin = jest.mocked(useIrmPlugin);

const SCHEDULES_PATH = '/api/plugins/:pluginId/resources/schedules/';

const schedules: OnCallSchedule[] = [
  { id: 's1', name: 'Primary', on_call_now: [{ pk: 'u1', username: 'alice' }] },
  // A schedule with nobody on call must contribute no row.
  { id: 's2', name: 'Secondary', on_call_now: [] },
];

function mockSchedules(results: OnCallSchedule[]) {
  server.use(http.get(SCHEDULES_PATH, () => HttpResponse.json({ results })));
}

beforeEach(() => {
  setPluginComponentsHook(() => ({ components: [], isLoading: false }));
  // Default: plugin installed, no access gates. Individual tests override as needed.
  mockUseIrmPlugin.mockReturnValue({
    pluginId: SupportedPlugin.OnCall,
    installed: true,
    loading: false,
    settings: { ...pluginMeta[SupportedPlugin.OnCall], includes: [] },
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('OnCallCard', () => {
  it('renders nothing when the OnCall plugin is not installed', () => {
    mockUseIrmPlugin.mockReturnValue({ pluginId: SupportedPlugin.OnCall, installed: false, loading: false });

    const { container } = render(<OnCallCard />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing while the plugin availability is still loading', () => {
    mockUseIrmPlugin.mockReturnValue({ pluginId: SupportedPlugin.OnCall, installed: undefined, loading: true });

    const { container } = render(<OnCallCard />);
    expect(container).toBeEmptyDOMElement();
  });

  it('lists who is on call now with schedule name, count badge, and a schedules link', async () => {
    mockSchedules(schedules);

    render(<OnCallCard />);

    expect(await screen.findByText('alice')).toBeInTheDocument();
    expect(screen.getByText('Primary')).toBeInTheDocument();

    // Header count badge reflects the number of on-call people (one row per on-call user).
    expect(screen.getByText('1')).toBeInTheDocument();

    // A schedule with an empty on_call_now contributes no row, so its name never renders.
    expect(screen.getByRole('listitem')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    expect(screen.queryByText('Secondary')).not.toBeInTheDocument();

    // The user's name links through the plugin bridge to the schedules page.
    expect(screen.getByRole('link', { name: 'alice' })).toHaveAttribute('href', '/a/grafana-oncall-app/schedules');
    expect(screen.getByRole('link', { name: /view schedules/i })).toBeInTheDocument();
  });

  it('flattens to one row per (schedule, on-call user)', async () => {
    mockSchedules([
      {
        id: 's1',
        name: 'Primary',
        on_call_now: [
          { pk: 'u1', username: 'alice' },
          { pk: 'u2', username: 'bob' },
        ],
      },
      { id: 's2', name: 'Backup', on_call_now: [{ pk: 'u1', username: 'alice' }] },
    ]);

    render(<OnCallCard />);

    expect(await screen.findByText('bob')).toBeInTheDocument();
    // alice is on call in two schedules -> two distinct rows; three rows total.
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('Backup')).toBeInTheDocument();
  });

  it('shows the empty state when no one is on call', async () => {
    mockSchedules([{ id: 's1', name: 'Primary', on_call_now: [] }]);

    render(<OnCallCard />);

    expect(await screen.findByText('No one is on call right now.')).toBeInTheDocument();
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument();
  });

  it('shows a retryable error when the schedules request fails', async () => {
    server.use(http.get(SCHEDULES_PATH, () => HttpResponse.json({}, { status: 500 })));

    render(<OnCallCard />);

    expect(await screen.findByText('Could not load on-call schedules')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    expect(screen.queryByText('No one is on call right now.')).not.toBeInTheDocument();
  });

  it('renders on-call names as plain text when the user cannot access the schedules page', async () => {
    jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(false);
    mockUseIrmPlugin.mockReturnValue({
      pluginId: SupportedPlugin.OnCall,
      installed: true,
      loading: false,
      settings: {
        ...pluginMeta[SupportedPlugin.OnCall],
        includes: [
          {
            type: PluginIncludeType.page,
            name: 'Schedules',
            path: '/a/grafana-oncall-app/schedules',
            action: 'grafana-oncall-app.schedules:read',
          },
        ],
      },
    });
    mockSchedules(schedules);

    render(<OnCallCard />);

    expect(await screen.findByText('alice')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'alice' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /view schedules/i })).not.toBeInTheDocument();
  });
});
