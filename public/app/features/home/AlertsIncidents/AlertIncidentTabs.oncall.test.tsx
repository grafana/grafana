import userEvent from '@testing-library/user-event';
import { act, render, screen, waitFor, within } from 'test/test-utils';

import { PluginIncludeType, setTimeZoneResolver } from '@grafana/data';
import { contextSrv } from 'app/core/services/context_srv';
import { type OnCallScheduleDTO } from 'app/features/alerting/unified/api/onCallApi';

import { ctaClicked, tabChanged } from '../analytics/main';

import {
  ALERTS_INCIDENTS_TAB_STORAGE_KEY,
  INCIDENTS_TAB_ID,
  ON_CALL_TAB_ID,
  type AlertIncidentSwitchHandle,
} from './AlertIncidentTabs';
import {
  AlertIncidentTabsWithData,
  makeAlert,
  mockAlerts,
  mockIrmPlugin,
  setupAlertIncidentTabsTests,
} from './alertIncidentTabsTestUtils';
import { mockIncidents } from './mockIncidentsApi';
import {
  bob,
  carol,
  me,
  mockCurrentUserEvents,
  mockCurrentUserEventsError,
  mockSchedules,
  mockSchedulesError,
  shiftEvent,
} from './mockOnCallSchedulesApi';

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

// Tuesday 10:00 UTC. Fixtures are absolute so a shift never drifts across midnight relative to the clock.
const NOW = Date.parse('2024-01-02T10:00:00Z');

const SCHEDULES_HREF = '/a/grafana-irm-app/schedules';
const EMPTY_MESSAGE = 'You have no shifts in the next 30 days, and nobody on your teams is on call right now.';
const LOAD_FAILED = 'Could not load schedules';

const S1: OnCallScheduleDTO = { id: 'S1', name: 'Primary', team: 'T1', on_call_now: [bob, me] };
const S2: OnCallScheduleDTO = { id: 'S2', name: 'Secondary', team: 'T2', on_call_now: [carol] };
const S3: OnCallScheduleDTO = { id: 'S3', name: 'Old', team: 'T1', on_call_now: [bob] };
const MINE = [S1, S2, S3];

/** A running shift on S1, an upcoming one on S2, and one on S3 that ended an hour ago. */
const MY_EVENTS = {
  schedules: [
    { id: 'S1', name: 'Primary', events: [shiftEvent({ start: '2024-01-02T08:00:00Z', end: '2024-01-02T17:00:00Z' })] },
    {
      id: 'S2',
      name: 'Secondary',
      events: [shiftEvent({ start: '2024-01-04T10:00:00Z', end: '2024-01-04T18:00:00Z' })],
    },
    { id: 'S3', name: 'Old', events: [shiftEvent({ start: '2024-01-02T06:00:00Z', end: '2024-01-02T09:00:00Z' })] },
  ],
};

const TEAM_SCHEDULES: Record<string, OnCallScheduleDTO[]> = {
  T1: [
    S1,
    S3,
    { id: 'S4', name: 'Platform', team: 'T1', on_call_now: [carol] },
    { id: 'S5', name: 'Quiet', team: 'T1', on_call_now: [] },
  ],
  T2: [S2, { id: 'S6', name: 'Backend', team: 'T2', on_call_now: [bob, carol] }],
};

/** IRM installed with the shared shift fixture; `listOptions` extends the schedule list mock. */
function mockOnCall(listOptions: { byTeam?: Record<string, OnCallScheduleDTO[]>; totalPages?: number } = {}) {
  mockIrmPlugin();
  const eventCalls = mockCurrentUserEvents(MY_EVENTS);
  const listCalls = mockSchedules({ mine: MINE, ...listOptions });
  return { eventCalls, listCalls };
}

/** Rows of the active tab panel in render order. */
function panelRows() {
  return within(screen.getByRole('tabpanel')).getAllByRole('listitem');
}

/** Schedule names of the rows in render order. */
function rowTitles() {
  return panelRows().map((row) => within(row).getAllByText(/\S/, { selector: 'p' })[0].textContent);
}

describe('AlertIncidentTabs On call tab', () => {
  beforeAll(() => setTimeZoneResolver(() => 'utc'));
  afterAll(() => setTimeZoneResolver(() => 'browser'));

  beforeEach(() => {
    jest.spyOn(Date, 'now').mockReturnValue(NOW);
    // The roster ordering and the on-call badge key off the signed-in login; the test bootData has none.
    jest.replaceProperty(contextSrv.user, 'login', 'admin');
    jest.mocked(tabChanged).mockClear();
    jest.mocked(ctaClicked).mockClear();
    mockAlerts([makeAlert({ labels: { alertname: 'CPU Critical', severity: 'critical' } })]);
    // The harness always runs useIncidents, which queries incidents once IRM is installed.
    mockIncidents([]);
  });

  it('renders no On call tab when the IRM plugin is absent', async () => {
    render(<AlertIncidentTabsWithData />);

    expect(await screen.findByText('CPU Critical')).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /on-call/i })).not.toBeInTheDocument();
  });

  it('shows the badge from the eager shift load and fetches schedule lists only when the tab opens', async () => {
    const { eventCalls, listCalls } = mockOnCall({ byTeam: TEAM_SCHEDULES });
    const { user } = render(<AlertIncidentTabsWithData />);

    expect(await screen.findByText('On call now')).toBeInTheDocument();
    expect(eventCalls).toHaveLength(1);
    expect(Object.fromEntries(eventCalls[0])).toEqual({ date: '2024-01-02', days: '30', user_tz: 'UTC' });
    expect(listCalls).toEqual([]);

    await user.click(screen.getByRole('tab', { name: /on-call/i }));
    expect(jest.mocked(tabChanged)).toHaveBeenCalledWith({ tab: ON_CALL_TAB_ID });

    expect(await screen.findByText('Backend')).toBeInTheDocument();
    // One list for every team the user's schedules belong to, read after the user's own list names them.
    expect(listCalls).toEqual([
      { filter: 'mine', page: 1 },
      { filter: 'team', teams: ['T1', 'T2'], page: 1 },
    ]);
  });

  it('refreshes your shifts together with the rosters each time the tab opens', async () => {
    const { eventCalls, listCalls } = mockOnCall({ byTeam: TEAM_SCHEDULES });
    const { user } = render(<AlertIncidentTabsWithData />);

    await user.click(await screen.findByRole('tab', { name: /on-call/i }));
    expect(await screen.findByText('Backend')).toBeInTheDocument();
    const eventCallsAfterFirstOpen = eventCalls.length;

    await user.click(screen.getByRole('tab', { name: /firing alerts/i }));
    await user.click(screen.getByRole('tab', { name: /on-call/i }));

    // Cached rows stay on screen while both sources refetch.
    expect(screen.getByText('Backend')).toBeInTheDocument();
    await waitFor(() => expect(eventCalls).toHaveLength(eventCallsAfterFirstOpen + 1));
    expect(listCalls.filter((call) => call.filter === 'mine')).toHaveLength(2);
  });

  it('polls both sources every 10 minutes while the tab is open, and only your shifts once it closes', async () => {
    jest.useFakeTimers({ doNotFake: ['Date'] });
    try {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      const { eventCalls, listCalls } = mockOnCall({ byTeam: TEAM_SCHEDULES });
      render(<AlertIncidentTabsWithData />);

      await user.click(await screen.findByRole('tab', { name: /on-call/i }));
      expect(await screen.findByText('Backend')).toBeInTheDocument();
      const eventsSoFar = eventCalls.length;
      const listsSoFar = listCalls.length;

      act(() => jest.advanceTimersByTime(10 * 60_000));
      await waitFor(() => expect(eventCalls).toHaveLength(eventsSoFar + 1));
      // mine, team
      await waitFor(() => expect(listCalls).toHaveLength(listsSoFar + 2));

      // The badge keeps following overrides and swaps; the costlier lists stop.
      await user.click(screen.getByRole('tab', { name: /firing alerts/i }));
      act(() => jest.advanceTimersByTime(10 * 60_000));
      await waitFor(() => expect(eventCalls).toHaveLength(eventsSoFar + 2));
      expect(listCalls).toHaveLength(listsSoFar + 2);
    } finally {
      jest.useRealTimers();
    }
  });

  it('lists your schedules first, then team schedules with someone on call', async () => {
    mockOnCall({ byTeam: TEAM_SCHEDULES });
    const { user } = render(<AlertIncidentTabsWithData />);

    await user.click(await screen.findByRole('tab', { name: /on-call/i }));
    expect(await screen.findByText('Backend')).toBeInTheDocument();

    // Running shift, upcoming shift, then team schedules by name. Old is a team row here: the user's shift on it
    // already ended while bob is on call. Quiet has nobody on call.
    expect(rowTitles()).toEqual(['Primary', 'Secondary', 'Backend', 'Old', 'Platform']);
    expect(screen.queryByText('Quiet')).not.toBeInTheDocument();

    const [primary, secondary, backend, old] = panelRows();
    expect(within(primary).getByText("You're on call until 17:00")).toBeInTheDocument();
    // The signed-in user leads the roster even though the API listed bob first.
    expect(within(primary).getByText('admin')).toBeInTheDocument();
    expect(within(primary).getByLabelText('admin icon')).toBeInTheDocument();
    expect(within(primary).getByLabelText('bob icon')).toBeInTheDocument();

    expect(within(secondary).getByText('Your next shift Jan 4, 10:00–18:00')).toBeInTheDocument();
    expect(within(secondary).getByText('carol')).toBeInTheDocument();

    // Team rows carry only the roster: the first login as text, everyone as an avatar.
    expect(
      within(backend)
        .getAllByText(/\S/, { selector: 'p' })
        .map((p) => p.textContent)
    ).toEqual(['Backend', 'bob']);
    expect(within(backend).getByLabelText('carol icon')).toBeInTheDocument();
    expect(within(old).getByText('bob')).toBeInTheDocument();
  });

  it('links rows and the footer to the plugin and tracks clicks per row kind', async () => {
    mockOnCall({ byTeam: TEAM_SCHEDULES });
    const { user } = render(<AlertIncidentTabsWithData />);

    await user.click(await screen.findByRole('tab', { name: /on-call/i }));
    expect(await screen.findByText('Backend')).toBeInTheDocument();

    const primaryLink = screen.getByRole('link', { name: /^Primary/ });
    expect(primaryLink).toHaveAttribute('href', `${SCHEDULES_HREF}/S1`);
    await user.click(primaryLink);
    expect(jest.mocked(ctaClicked)).toHaveBeenLastCalledWith({
      surface: 'oncall_card',
      action: 'my_shift_detail',
      placement: 'list',
    });

    const backendLink = screen.getByRole('link', { name: /^Backend/ });
    expect(backendLink).toHaveAttribute('href', `${SCHEDULES_HREF}/S6`);
    await user.click(backendLink);
    expect(jest.mocked(ctaClicked)).toHaveBeenLastCalledWith({
      surface: 'oncall_card',
      action: 'team_schedule_detail',
      placement: 'list',
    });

    expect(screen.getByRole('link', { name: /view schedules/i })).toHaveAttribute('href', SCHEDULES_HREF);
  });

  describe('pagination', () => {
    it('reads every page of your own list but stops the team list after five', async () => {
      const { listCalls } = mockOnCall({ byTeam: { T1: [S1, S3] }, totalPages: 7 });
      const { user } = render(<AlertIncidentTabsWithData />);

      await user.click(await screen.findByRole('tab', { name: /on-call/i }));
      expect(await screen.findByText('Old')).toBeInTheDocument();

      const pagesOf = (filter: 'mine' | 'team') =>
        listCalls
          .filter((call) => call.filter === filter)
          .map((call) => call.page)
          .sort((a, b) => a - b);
      expect(pagesOf('mine')).toEqual([1, 2, 3, 4, 5, 6, 7]);
      expect(pagesOf('team')).toEqual([1, 2, 3, 4, 5]);
    });

    it('renders schedules from a later page', async () => {
      const fillers: OnCallScheduleDTO[] = Array.from({ length: 100 }, (_, i) => ({
        id: `F${i}`,
        name: `Filler ${i}`,
        team: 'T1',
        on_call_now: [],
      }));
      const lastPage: OnCallScheduleDTO = { id: 'S7', name: 'Zulu', team: 'T1', on_call_now: [carol] };
      const { listCalls } = mockOnCall({ byTeam: { T1: [...fillers, lastPage] }, totalPages: 2 });
      const { user } = render(<AlertIncidentTabsWithData />);

      await user.click(await screen.findByRole('tab', { name: /on-call/i }));

      expect(await screen.findByText('Zulu')).toBeInTheDocument();
      expect(
        listCalls
          .filter((call) => call.filter === 'team')
          .map((call) => call.page)
          .sort()
      ).toEqual([1, 2]);
    });
  });

  describe('rosters and empty states', () => {
    it('shows your schedules without team requests when none has a team, and flags an empty roster', async () => {
      mockIrmPlugin();
      mockCurrentUserEvents(MY_EVENTS);
      const listCalls = mockSchedules({
        mine: [S1, { ...S2, on_call_now: [] }, S3].map((schedule) => ({ ...schedule, team: null })),
      });
      const { user } = render(<AlertIncidentTabsWithData />);

      await user.click(await screen.findByRole('tab', { name: /on-call/i }));

      expect(await screen.findByText('Primary')).toBeInTheDocument();
      expect(rowTitles()).toEqual(['Primary', 'Secondary', 'Old']);
      expect(within(panelRows()[1]).getByText('Nobody on call')).toBeInTheDocument();
      expect(listCalls).toEqual([{ filter: 'mine', page: 1 }]);
    });

    it('hides a schedule of yours once its shift ended and nobody is on call', async () => {
      mockIrmPlugin();
      mockCurrentUserEvents(MY_EVENTS);
      mockSchedules({ mine: [S1, S2, { ...S3, on_call_now: [] }].map((schedule) => ({ ...schedule, team: null })) });
      const { user } = render(<AlertIncidentTabsWithData />);

      await user.click(await screen.findByRole('tab', { name: /on-call/i }));

      expect(await screen.findByText('Primary')).toBeInTheDocument();
      expect(rowTitles()).toEqual(['Primary', 'Secondary']);
    });

    it('shows your shift on a schedule the list withholds, without a roster or a link', async () => {
      mockIrmPlugin();
      mockCurrentUserEvents(MY_EVENTS);
      // S1 belongs to a team the user isn't in: the shifts endpoint reports it, the list leaves it out.
      mockSchedules({ mine: [S2, S3].map((schedule) => ({ ...schedule, team: null })) });
      const { user } = render(<AlertIncidentTabsWithData />);

      await user.click(await screen.findByRole('tab', { name: /on-call/i }));

      expect(await screen.findByText('Primary')).toBeInTheDocument();
      expect(rowTitles()).toEqual(['Primary', 'Secondary', 'Old']);
      const [primary, secondary] = panelRows();
      expect(within(primary).getByText("You're on call until 17:00")).toBeInTheDocument();
      expect(within(primary).queryByText('Nobody on call')).not.toBeInTheDocument();
      expect(within(primary).queryByLabelText(/icon$/)).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /^Primary/ })).not.toBeInTheDocument();
      expect(within(secondary).getByRole('link', { name: /^Secondary/ })).toBeInTheDocument();
      expect(screen.getByText('On call now')).toBeInTheDocument();
    });

    it('shows the empty message when no schedule has a shift of yours or anyone on call', async () => {
      mockIrmPlugin();
      mockCurrentUserEvents({ schedules: [] });
      const listCalls = mockSchedules({});
      const { user } = render(<AlertIncidentTabsWithData />);

      await user.click(await screen.findByRole('tab', { name: /on-call/i }));

      expect(await screen.findByText(EMPTY_MESSAGE)).toBeInTheDocument();
      expect(screen.queryByText('On call now')).not.toBeInTheDocument();
      expect(screen.getByRole('link', { name: /view schedules/i })).toHaveAttribute('href', SCHEDULES_HREF);
      expect(listCalls).toEqual([{ filter: 'mine', page: 1 }]);
    });
  });

  describe('errors', () => {
    it.each([
      [404, 'Grafana IRM is not available'],
      [403, "You don't have access to IRM schedules"],
      [500, LOAD_FAILED],
    ])('shows the message for a %i on the shift events', async (status, message) => {
      mockIrmPlugin();
      mockCurrentUserEventsError(status);
      const { user } = render(<AlertIncidentTabsWithData />);

      await user.click(await screen.findByRole('tab', { name: /on-call/i }));

      expect(await screen.findByText(message)).toBeInTheDocument();
      expect(screen.queryByText('On call now')).not.toBeInTheDocument();
    });

    it('fails the view, keeping the badge, when the schedule list fails', async () => {
      mockOnCall({ byTeam: TEAM_SCHEDULES });
      mockSchedulesError(500, 'team');
      const { user } = render(<AlertIncidentTabsWithData />);

      await user.click(await screen.findByRole('tab', { name: /on-call/i }));

      expect(await screen.findByText(LOAD_FAILED)).toBeInTheDocument();
      expect(screen.queryByText('Primary')).not.toBeInTheDocument();
      expect(screen.getByText('On call now')).toBeInTheDocument();
    });

    it('retries the shift events', async () => {
      mockIrmPlugin();
      mockCurrentUserEventsError(500);
      mockSchedules({ mine: MINE, byTeam: TEAM_SCHEDULES });
      const { user } = render(<AlertIncidentTabsWithData />);

      await user.click(await screen.findByRole('tab', { name: /on-call/i }));
      expect(await screen.findByText(LOAD_FAILED)).toBeInTheDocument();

      mockCurrentUserEvents(MY_EVENTS);
      await user.click(screen.getByRole('button', { name: /retry/i }));

      expect(await screen.findByText('Backend')).toBeInTheDocument();
      expect(screen.getByText('On call now')).toBeInTheDocument();
    });

    it('retries the schedule list', async () => {
      mockOnCall({ byTeam: TEAM_SCHEDULES });
      mockSchedulesError(500, 'team');
      const { user } = render(<AlertIncidentTabsWithData />);

      await user.click(await screen.findByRole('tab', { name: /on-call/i }));
      expect(await screen.findByText(LOAD_FAILED)).toBeInTheDocument();

      mockSchedules({ mine: MINE, byTeam: TEAM_SCHEDULES });
      await user.click(screen.getByRole('button', { name: /retry/i }));

      expect(await screen.findByText('Backend')).toBeInTheDocument();
      expect(rowTitles()).toEqual(['Primary', 'Secondary', 'Backend', 'Old', 'Platform']);
    });
  });

  it('renders titles as text and no footer link without access to the schedules page', async () => {
    jest
      .spyOn(contextSrv, 'hasPermission')
      .mockImplementation((action: string) => action !== 'grafana-irm-app.schedules:read');
    mockIrmPlugin({
      includes: [
        {
          type: PluginIncludeType.page,
          name: 'Schedules',
          path: SCHEDULES_HREF,
          action: 'grafana-irm-app.schedules:read',
        },
      ],
    });
    mockCurrentUserEvents(MY_EVENTS);
    mockSchedules({ mine: MINE, byTeam: TEAM_SCHEDULES });
    const { user } = render(<AlertIncidentTabsWithData />);

    await user.click(await screen.findByRole('tab', { name: /on-call/i }));

    expect(await screen.findByText('Backend')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^Primary/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^Backend/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /view schedules/i })).not.toBeInTheDocument();
  });

  it("requests the window from today in the user's time zone", async () => {
    setTimeZoneResolver(() => 'Europe/Berlin');
    // 00:30 on Wednesday in Berlin, still Tuesday in UTC.
    jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2024-01-02T23:30:00Z'));
    try {
      const { eventCalls } = mockOnCall();
      render(<AlertIncidentTabsWithData />);

      await screen.findByRole('tab', { name: /on-call/i });
      await waitFor(() => expect(eventCalls).toHaveLength(1));
      expect(Object.fromEntries(eventCalls[0])).toEqual({ date: '2024-01-03', days: '30', user_tz: 'Europe/Berlin' });
    } finally {
      setTimeZoneResolver(() => 'utc');
    }
  });

  describe('remembered tab', () => {
    it('reopens on the stored tab, selected before the plugin probe settles', async () => {
      window.localStorage.setItem(ALERTS_INCIDENTS_TAB_STORAGE_KEY, ON_CALL_TAB_ID);
      mockOnCall({ byTeam: TEAM_SCHEDULES });
      render(<AlertIncidentTabsWithData />);

      // Offered on the strength of the memory alone, so no other tab paints first.
      expect(screen.getByRole('tab', { name: /on-call/i })).toHaveAttribute('aria-selected', 'true');
      expect(await screen.findByText('Backend')).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /on-call/i })).toHaveAttribute('aria-selected', 'true');
      expect(jest.mocked(tabChanged)).not.toHaveBeenCalled();
    });

    it('falls back to Firing alerts once the probe says the stored tab is unavailable', async () => {
      window.localStorage.setItem(ALERTS_INCIDENTS_TAB_STORAGE_KEY, ON_CALL_TAB_ID);
      render(<AlertIncidentTabsWithData />);

      expect(await screen.findByText('CPU Critical')).toBeInTheDocument();
      await waitFor(() => expect(screen.queryByRole('tab', { name: /on-call/i })).not.toBeInTheDocument());
      expect(screen.getByRole('tab', { name: /firing alerts/i })).toHaveAttribute('aria-selected', 'true');
    });

    it('stores the tab on click and on imperative switch', async () => {
      mockOnCall({ byTeam: TEAM_SCHEDULES });
      let handle: AlertIncidentSwitchHandle | null = null;
      const { user } = render(
        <AlertIncidentTabsWithData
          switchRef={(instance) => {
            handle = instance;
          }}
        />
      );

      await user.click(await screen.findByRole('tab', { name: /on-call/i }));
      expect(await screen.findByText('Backend')).toBeInTheDocument();
      expect(window.localStorage.getItem(ALERTS_INCIDENTS_TAB_STORAGE_KEY)).toBe(ON_CALL_TAB_ID);

      await act(async () => {
        handle?.switch(INCIDENTS_TAB_ID, false);
      });

      expect(await screen.findByText('All quiet! No active incidents.')).toBeInTheDocument();
      expect(window.localStorage.getItem(ALERTS_INCIDENTS_TAB_STORAGE_KEY)).toBe('incidents');
    });
  });
});
