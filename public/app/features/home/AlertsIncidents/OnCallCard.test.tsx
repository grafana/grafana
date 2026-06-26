import { http, HttpResponse } from 'msw';
import { render, screen, within } from 'test/test-utils';

import { PluginIncludeType } from '@grafana/data';
import { setBackendSrv, setPluginComponentsHook } from '@grafana/runtime';
import server, { setupMockServer } from '@grafana/test-utils/server';
import { backendSrv } from 'app/core/services/backend_srv';
import { contextSrv } from 'app/core/services/context_srv';
import { type OnCallCurrentUserEventsResponse } from 'app/features/alerting/unified/api/onCallApi';
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

const CURRENT_USER_EVENTS_PATH = '/api/plugins/:pluginId/resources/schedules/current_user_events/';
const NOW = Date.parse('2026-06-26T10:00:00.000Z');

const personalEvents: OnCallCurrentUserEventsResponse = {
  is_oncall: false,
  schedules: [
    {
      id: 's1',
      name: 'Primary',
      events: [
        event('2026-06-26T08:00:00Z', '2026-06-26T09:00:00Z', 'expired'),
        event('2026-06-26T12:00:00Z', '2026-06-26T14:00:00Z', 'primary'),
      ],
    },
    {
      id: 's2',
      name: 'Secondary',
      events: [
        event('2026-06-27T12:00:00Z', '2026-06-27T14:00:00Z', 'gap', { is_gap: true }),
        event('2026-06-28T12:00:00Z', '2026-06-28T14:00:00Z', 'empty', { is_empty: true }),
      ],
    },
    {
      id: 's3',
      name: 'Backup',
      events: [event('2026-06-27T08:00:00Z', '2026-06-27T10:00:00Z', 'backup')],
    },
  ],
};

function event(
  start: string,
  end: string,
  shiftId: string,
  overrides: Partial<OnCallCurrentUserEventsResponse['schedules'][number]['events'][number]> = {}
) {
  return {
    start,
    end,
    shift: { pk: shiftId },
    ...overrides,
  };
}

function mockCurrentUserEvents(response: OnCallCurrentUserEventsResponse) {
  server.use(http.get(CURRENT_USER_EVENTS_PATH, () => HttpResponse.json(response)));
}

beforeEach(() => {
  jest.spyOn(Date, 'now').mockReturnValue(NOW);
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

  it('lists current user shifts with schedule name, count badge, and schedule links', async () => {
    mockCurrentUserEvents(personalEvents);

    render(<OnCallCard />);

    expect(await screen.findByText('Primary')).toBeInTheDocument();
    expect(screen.getByText('Backup')).toBeInTheDocument();
    expect(screen.getByText('On-call shifts')).toBeInTheDocument();

    expect(screen.getByText('2')).toBeInTheDocument();

    // Expired, gap, and empty events contribute no rows.
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.queryByText('Secondary')).not.toBeInTheDocument();

    expect(screen.getByRole('link', { name: 'Primary' })).toHaveAttribute('href', '/a/grafana-oncall-app/schedules/s1');
    expect(screen.getByRole('link', { name: /view schedules/i })).toBeInTheDocument();
  });

  it('requests personal schedule events with a buffered future window', async () => {
    let requestUrl: URL | undefined;
    server.use(
      http.get(CURRENT_USER_EVENTS_PATH, ({ request }) => {
        requestUrl = new URL(request.url);
        return HttpResponse.json({ is_oncall: false, schedules: [] });
      })
    );

    render(<OnCallCard />);

    expect(await screen.findByText('No upcoming shifts found.')).toBeInTheDocument();
    expect(requestUrl?.searchParams.get('date')).toBe('2026-06-25');
    expect(requestUrl?.searchParams.get('days')).toBe('33');
    expect(requestUrl?.searchParams.get('user_tz')).toBeTruthy();
  });

  it('sorts shifts chronologically and renders only the next three', async () => {
    mockCurrentUserEvents({
      is_oncall: false,
      schedules: [
        {
          id: 's4',
          name: 'Fourth',
          events: [event('2026-06-30T12:00:00Z', '2026-06-30T14:00:00Z', 'fourth')],
        },
        {
          id: 's2',
          name: 'Second',
          events: [event('2026-06-28T12:00:00Z', '2026-06-28T14:00:00Z', 'second')],
        },
        {
          id: 's1',
          name: 'First',
          events: [event('2026-06-27T12:00:00Z', '2026-06-27T14:00:00Z', 'first')],
        },
        {
          id: 's3',
          name: 'Third',
          events: [event('2026-06-29T12:00:00Z', '2026-06-29T14:00:00Z', 'third')],
        },
      ],
    });

    render(<OnCallCard />);

    expect(await screen.findByText('First')).toBeInTheDocument();

    const rows = screen.getAllByRole('listitem');
    expect(rows).toHaveLength(3);
    expect(within(rows[0]).getByText('First')).toBeInTheDocument();
    expect(within(rows[1]).getByText('Second')).toBeInTheDocument();
    expect(within(rows[2]).getByText('Third')).toBeInTheDocument();
    expect(screen.queryByText('Fourth')).not.toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('deduplicates identical schedule events', async () => {
    const duplicateShift = event('2026-06-27T12:00:00Z', '2026-06-27T14:00:00Z', 'duplicate');
    mockCurrentUserEvents({
      is_oncall: false,
      schedules: [
        {
          id: 's1',
          name: 'Primary',
          events: [duplicateShift, duplicateShift],
        },
      ],
    });

    render(<OnCallCard />);

    expect(await screen.findByText('Primary')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
  });

  it('shows the empty state when the current user has no upcoming shifts', async () => {
    mockCurrentUserEvents({
      is_oncall: false,
      schedules: [
        {
          id: 's1',
          name: 'Primary',
          events: [event('2026-06-26T08:00:00Z', '2026-06-26T09:00:00Z', 'expired')],
        },
      ],
    });

    render(<OnCallCard />);

    expect(await screen.findByText('No upcoming shifts found.')).toBeInTheDocument();
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument();
  });

  it('shows a retryable error when the shifts request fails', async () => {
    server.use(http.get(CURRENT_USER_EVENTS_PATH, () => HttpResponse.json({}, { status: 500 })));

    render(<OnCallCard />);

    expect(await screen.findByText('Could not load on-call shifts')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    expect(screen.queryByText('No upcoming shifts found.')).not.toBeInTheDocument();
  });

  it('renders schedule names as plain text when the user cannot access the schedules page', async () => {
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
    mockCurrentUserEvents(personalEvents);

    render(<OnCallCard />);

    expect(await screen.findByText('Primary')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Primary' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /view schedules/i })).not.toBeInTheDocument();
  });
});
