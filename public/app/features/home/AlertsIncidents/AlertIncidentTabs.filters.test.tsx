import { http, HttpResponse } from 'msw';
import { render, screen, waitFor, within } from 'test/test-utils';

import server from '@grafana/test-utils/server';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

import {
  AlertIncidentTabsWithData,
  RULES_URL,
  activeIncident,
  makeAlert,
  mockAlerts,
  mockIrmPlugin,
  mockRuleLabels,
  mockTeamLabelValues,
  mockTeams,
  setupAlertIncidentTabsTests,
} from './alertIncidentTabsTestSetup';
import {
  ACTIVE_INCIDENTS_QUERY,
  GET_FIELDS_PATH,
  mockIncidentFields,
  mockIncidentTeamField,
  mockIncidents,
  mockNoIncidentFields,
} from './mockIncidentsApi';

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

/**
 * Wire form of useFiringAlerts' tolerant own-teams pattern for one team name:
 * its letter/digit runs joined by separator gaps. quoteWithEscape doubles the
 * pattern's backslashes when the matcher is serialized into the filter param.
 */
function wireTolerantPattern(...runs: string[]) {
  const sep = '[^\\\\p{L}\\\\p{N}]*';
  return sep + runs.join(sep) + sep;
}

describe('AlertIncidentTabs filters', () => {
  describe('alerts filter dropdown', () => {
    it('fetches the rule labels only when the dropdown opens, once across tab switches', async () => {
      const requests = mockTeamLabelValues(['Team A']);
      mockAlerts([makeAlert({ labels: { alertname: 'CPU Critical', severity: 'critical' } })]);
      mockIrmPlugin();
      mockIncidents([activeIncident]);

      const { user } = render(<AlertIncidentTabsWithData />);

      expect(await screen.findByText('CPU Critical')).toBeInTheDocument();
      const combobox = await screen.findByRole('combobox', { name: /filter alerts by label/i });
      // Listing labels downloads every rule in the org, so a visit that never opens the filter skips it.
      expect(requests).toEqual([]);

      await user.click(combobox);
      expect(await screen.findByRole('option', { name: 'Team A' })).toBeInTheDocument();
      expect(requests).toHaveLength(1);

      await user.click(screen.getByRole('tab', { name: /incidents/i }));
      expect(await screen.findByText('Database outage')).toBeInTheDocument();
      expect(screen.queryByRole('combobox', { name: /filter alerts by label/i })).not.toBeInTheDocument();

      // Switching back and reopening reuses the fetched labels rather than refetching them.
      await user.click(screen.getByRole('tab', { name: /firing alerts/i }));
      await user.click(await screen.findByRole('combobox', { name: /filter alerts by label/i }));

      expect(await screen.findByRole('option', { name: 'Team A' })).toBeInTheDocument();
      expect(requests).toHaveLength(1);
    });

    it("waits for the user's teams before showing the dropdown, so a team member's default reads 'Your teams'", async () => {
      let releaseTeams!: () => void;
      const teamsGate = new Promise<void>((resolve) => (releaseTeams = resolve));
      server.use(
        http.get('/api/user/teams', async () => {
          await teamsGate;
          return HttpResponse.json([{ id: 1, uid: 'team-0', orgId: 1, name: 'Team A', memberCount: 1 }]);
        })
      );

      render(<AlertIncidentTabsWithData />);

      // Before teams load, "All alerts" would be the wrong default for a team member.
      expect(await screen.findByRole('tab', { name: /firing alerts/i })).toBeInTheDocument();
      expect(screen.queryByRole('combobox', { name: /filter alerts by label/i })).not.toBeInTheDocument();

      releaseTeams();

      expect(await screen.findByRole('combobox', { name: /filter alerts by label/i })).toHaveDisplayValue('Your teams');
    });

    it('puts each tab filter inside the panel named after that tab', async () => {
      mockTeamLabelValues(['Team A']);
      mockAlerts([makeAlert({ labels: { alertname: 'CPU Critical', severity: 'critical' } })]);
      mockIrmPlugin();
      mockIncidentTeamField(['Team A', 'Team B']);
      mockIncidents([activeIncident]);

      const { user } = render(<AlertIncidentTabsWithData />);

      // The panel takes its name from the active tab, so the filter it contains
      // can only be read as scoped to that tab.
      const alertsPanel = await screen.findByRole('tabpanel', { name: /firing alerts/i });
      expect(await within(alertsPanel).findByRole('combobox', { name: /filter alerts by label/i })).toBeInTheDocument();

      await user.click(screen.getByRole('tab', { name: /incidents/i }));

      const incidentsPanel = await screen.findByRole('tabpanel', { name: /incidents/i });
      expect(
        await within(incidentsPanel).findByRole('combobox', { name: /filter incidents by label/i })
      ).toBeInTheDocument();
    });

    it('refetches alerts filtered to exactly the picked team', async () => {
      mockTeams([{ name: 'Team A' }, { name: 'Team B' }]);
      mockTeamLabelValues(['Team A', 'Team B', 'Team C']);
      const requests = mockAlerts([makeAlert({ labels: { alertname: 'CPU Critical', severity: 'critical' } })]);

      const { user } = render(<AlertIncidentTabsWithData />);

      // Initial request is filtered to the user's own teams, matched tolerantly
      // ((?i) + separator gaps) since the free-form `team` label usually carries
      // some slugged or re-cased variant of the team name.
      expect(await screen.findByText('CPU Critical')).toBeInTheDocument();
      expect(requests).toHaveLength(1);
      expect(requests[0]).toEqual([
        `team=~"(?i)${wireTolerantPattern('Team', 'A')}|${wireTolerantPattern('Team', 'B')}"`,
      ]);

      await user.click(await screen.findByRole('combobox', { name: /filter alerts by label/i }));
      // This user belongs to teams, so the default option describes that scope and
      // an explicit "All alerts" escape hatch follows it, ahead of the labels.
      const options = await screen.findAllByRole('option');
      expect(options[0]).toHaveTextContent('Your teams');
      expect(options[1]).toHaveTextContent('All alerts');
      expect(options[2]).toHaveTextContent('Team A');
      await user.click(await screen.findByRole('option', { name: 'Team C' }));

      // The pick is a value set on a real rule, so it's matched as-is rather than tolerantly.
      await waitFor(() => expect(requests).toHaveLength(2));
      expect(requests[1]).toEqual(['team="Team C"']);
    });

    it("restores the user's own-teams scope when selecting the 'Your teams' option", async () => {
      mockTeams([{ name: 'Team A' }]);
      mockTeamLabelValues(['Team A', 'Team C']);
      // The user's own teams have a firing alert; the explicitly selected team has none.
      server.use(
        http.get('/api/alertmanager/:datasourceUid/api/v2/alerts', ({ request }) => {
          const filters = new URL(request.url).searchParams.getAll('filter');
          const isSelectedTeamFilter = filters.some((f) => f.includes('Team C'));
          return HttpResponse.json(
            isSelectedTeamFilter ? [] : [makeAlert({ labels: { alertname: 'CPU Critical', severity: 'critical' } })]
          );
        })
      );

      const { user } = render(<AlertIncidentTabsWithData />);

      expect(await screen.findByText('CPU Critical')).toBeInTheDocument();
      const combobox = await screen.findByRole('combobox', { name: /filter alerts by label/i });

      await user.click(combobox);
      await user.click(await screen.findByRole('option', { name: 'Team C' }));
      expect(await screen.findByText('No firing alerts with team=Team C.')).toBeInTheDocument();

      // Picking "Your teams" clears the explicit selection and brings back the default view.
      await user.click(combobox);
      await user.click(await screen.findByRole('option', { name: 'Your teams' }));

      expect(await screen.findByText('CPU Critical')).toBeInTheDocument();
      expect(combobox).toHaveDisplayValue('Your teams');
    });

    it("shows unfiltered org-wide alerts when a team member selects 'All alerts'", async () => {
      mockTeams([{ name: 'Team A' }]);
      mockTeamLabelValues(['Team A', 'Team C']);
      // Own-teams requests see one alert; the unfiltered request also surfaces an
      // alert from another team and one with no team label at all.
      const requests: string[][] = [];
      server.use(
        http.get('/api/alertmanager/:datasourceUid/api/v2/alerts', ({ request }) => {
          const filters = new URL(request.url).searchParams.getAll('filter');
          requests.push(filters);
          const ownAlert = makeAlert({ labels: { alertname: 'CPU Critical', severity: 'critical', team: 'Team A' } });
          if (filters.length > 0) {
            return HttpResponse.json([ownAlert]);
          }
          return HttpResponse.json([
            ownAlert,
            makeAlert({ labels: { alertname: 'Disk Full', severity: 'high', team: 'Team C' } }),
            makeAlert({ labels: { alertname: 'Unlabeled Alert', severity: 'low' } }),
          ]);
        })
      );

      const { user } = render(<AlertIncidentTabsWithData />);

      expect(await screen.findByText('CPU Critical')).toBeInTheDocument();
      const combobox = await screen.findByRole('combobox', { name: /filter alerts by label/i });

      await user.click(combobox);
      await user.click(await screen.findByRole('option', { name: 'All alerts' }));

      // The explicit "All alerts" request carries no matchers at all.
      await waitFor(() => expect(requests).toHaveLength(2));
      expect(requests[1]).toEqual([]);

      // Rows include alerts outside the user's teams and without a team label,
      // and the tab counter reflects the unfiltered total.
      expect(await screen.findByText('Disk Full')).toBeInTheDocument();
      expect(screen.getByText('Unlabeled Alert')).toBeInTheDocument();
      expect(screen.getByText('CPU Critical')).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /firing alerts/i })).toHaveTextContent('3');
      expect(combobox).toHaveDisplayValue('All alerts');
    });

    it("shows the generic empty message when 'All alerts' is selected and there are no alerts", async () => {
      mockTeams([{ name: 'Team A' }]);
      mockTeamLabelValues(['Team A', 'Team C']);
      // The user's own teams have a firing alert; the org as a whole has none
      // (contrived, but isolates the empty copy for the org-wide scope).
      server.use(
        http.get('/api/alertmanager/:datasourceUid/api/v2/alerts', ({ request }) => {
          const filters = new URL(request.url).searchParams.getAll('filter');
          return HttpResponse.json(
            filters.length === 0 ? [] : [makeAlert({ labels: { alertname: 'CPU Critical', severity: 'critical' } })]
          );
        })
      );

      const { user } = render(<AlertIncidentTabsWithData />);

      expect(await screen.findByText('CPU Critical')).toBeInTheDocument();
      await user.click(await screen.findByRole('combobox', { name: /filter alerts by label/i }));
      await user.click(await screen.findByRole('option', { name: 'All alerts' }));

      // The sentinel never leaks into copy; the generic empty message is used.
      expect(await screen.findByText('You have no firing alerts.')).toBeInTheDocument();
      expect(screen.queryByText(/No firing alerts with/)).not.toBeInTheDocument();
    });

    it("restores the own-teams filter when selecting 'Your teams' after 'All alerts'", async () => {
      mockTeams([{ name: 'Team A' }]);
      mockTeamLabelValues(['Team A', 'Team C']);
      const requests = mockAlerts([makeAlert({ labels: { alertname: 'CPU Critical', severity: 'critical' } })]);

      const { user } = render(<AlertIncidentTabsWithData />);

      const ownTeamsFilter = `team=~"(?i)${wireTolerantPattern('Team', 'A')}"`;

      expect(await screen.findByText('CPU Critical')).toBeInTheDocument();
      expect(requests[0]).toEqual([ownTeamsFilter]);
      const combobox = await screen.findByRole('combobox', { name: /filter alerts by label/i });

      await user.click(combobox);
      await user.click(await screen.findByRole('option', { name: 'All alerts' }));
      await waitFor(() => expect(requests).toHaveLength(2));
      expect(requests[1]).toEqual([]);

      await user.click(combobox);
      await user.click(await screen.findByRole('option', { name: 'Your teams' }));

      // Back to the default scope: the request is filtered to the user's own teams again.
      await waitFor(() => expect(combobox).toHaveDisplayValue('Your teams'));
      // RTK Query re-serves the cached own-teams entry rather than refetching, so
      // assert on the requests that were made, not on a new one.
      expect(requests.every((r) => r.length === 0 || r[0] === ownTeamsFilter)).toBe(true);
      expect(await screen.findByText('CPU Critical')).toBeInTheDocument();
    });

    it('shows the loading skeleton while the switched team request is in flight, then the filtered alerts', async () => {
      mockTeams([{ name: 'Team A' }]);
      mockTeamLabelValues(['Team A', 'Team C']);

      // First request (user's teams) resolves immediately; the second (Team C) is
      // held open behind a gate so the in-flight loading state can be observed.
      let releaseSecondRequest!: () => void;
      const secondRequestGate = new Promise<void>((resolve) => (releaseSecondRequest = resolve));
      let alertRequests = 0;
      server.use(
        http.get('/api/alertmanager/:datasourceUid/api/v2/alerts', async () => {
          alertRequests++;
          if (alertRequests > 1) {
            await secondRequestGate;
            return HttpResponse.json([makeAlert({ labels: { alertname: 'Disk Full', severity: 'high' } })]);
          }
          return HttpResponse.json([makeAlert({ labels: { alertname: 'CPU Critical', severity: 'critical' } })]);
        })
      );

      const { user } = render(<AlertIncidentTabsWithData />);

      expect(await screen.findByText('CPU Critical')).toBeInTheDocument();
      expect(screen.queryByTestId('summary-card-skeleton')).not.toBeInTheDocument();

      await user.click(await screen.findByRole('combobox', { name: /filter alerts by label/i }));
      await user.click(await screen.findByRole('option', { name: 'Team C' }));

      // While the filtered request is pending, the skeleton replaces the stale rows.
      expect(await screen.findByTestId('summary-card-skeleton')).toBeInTheDocument();
      expect(screen.queryByText('CPU Critical')).not.toBeInTheDocument();

      releaseSecondRequest();

      expect(await screen.findByText('Disk Full')).toBeInTheDocument();
      expect(screen.queryByTestId('summary-card-skeleton')).not.toBeInTheDocument();
    });

    it('does not refetch when re-selecting the already selected team', async () => {
      mockTeams([{ name: 'Team A' }]);
      mockTeamLabelValues(['Team A', 'Team C']);
      const requests = mockAlerts([makeAlert({ labels: { alertname: 'CPU Critical', severity: 'critical' } })]);

      const { user } = render(<AlertIncidentTabsWithData />);

      expect(await screen.findByText('CPU Critical')).toBeInTheDocument();
      const combobox = await screen.findByRole('combobox', { name: /filter alerts by label/i });

      await user.click(combobox);
      await user.click(await screen.findByRole('option', { name: 'Team C' }));
      await waitFor(() => expect(requests).toHaveLength(2));

      // Picking the same team again is a no-op: no state change, no new request.
      await user.click(combobox);
      await user.click(await screen.findByRole('option', { name: 'Team C' }));

      expect(combobox).toHaveDisplayValue('Team C');
      expect(requests).toHaveLength(2);
    });

    it('shows a team-scoped empty message when the selected team has no alerts', async () => {
      mockTeams([{ name: 'Team A' }]);
      mockTeamLabelValues(['Team A', 'Team C']);
      // The user's own teams have a firing alert; the explicitly selected team has none.
      server.use(
        http.get('/api/alertmanager/:datasourceUid/api/v2/alerts', ({ request }) => {
          const filters = new URL(request.url).searchParams.getAll('filter');
          const isSelectedTeamFilter = filters.some((f) => f.includes('Team C'));
          return HttpResponse.json(
            isSelectedTeamFilter ? [] : [makeAlert({ labels: { alertname: 'CPU Critical', severity: 'critical' } })]
          );
        })
      );

      const { user } = render(<AlertIncidentTabsWithData />);

      expect(await screen.findByText('CPU Critical')).toBeInTheDocument();
      await user.click(await screen.findByRole('combobox', { name: /filter alerts by label/i }));
      await user.click(await screen.findByRole('option', { name: 'Team C' }));

      // The empty copy names the picked label instead of claiming "your teams".
      expect(await screen.findByText('No firing alerts with team=Team C.')).toBeInTheDocument();
      expect(screen.queryByText('No firing alerts for your teams.')).not.toBeInTheDocument();
    });

    it('filters the fetched label values client-side as the user types', async () => {
      mockTeamLabelValues(['Team Alpha', 'Team Beta', 'Zebra Squad']);
      mockAlerts([makeAlert({ labels: { alertname: 'CPU Critical', severity: 'critical' } })]);

      const { user } = render(<AlertIncidentTabsWithData />);

      expect(await screen.findByText('CPU Critical')).toBeInTheDocument();
      const combobox = await screen.findByRole('combobox', { name: /filter alerts by label/i });
      await user.click(combobox);

      // Default list: the default-scope option plus every fetched value. This user
      // belongs to no teams, so the default scope is unfiltered and the option reads
      // "All alerts" — exactly once, with no duplicate from the explicit "All alerts"
      // option team members get.
      expect(await screen.findByRole('option', { name: 'All alerts' })).toBeInTheDocument();
      expect(screen.getAllByRole('option', { name: 'All alerts' })).toHaveLength(1);
      expect(screen.getByRole('option', { name: 'Team Alpha' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Zebra Squad' })).toBeInTheDocument();

      // Typing narrows the list client-side (case-insensitive contains) and drops
      // the scope sentinels. Use keyboard() instead of type(): type() re-clicks the
      // input, which toggles the menu closed and flushes the selected label into it.
      await user.keyboard('zebra');
      // "Zebra Squad" is already on the unfiltered list, so wait for the others to
      // drop out rather than for it to appear.
      await waitFor(() => expect(screen.queryByRole('option', { name: 'Team Alpha' })).not.toBeInTheDocument());
      expect(screen.getByRole('option', { name: 'Zebra Squad' })).toBeInTheDocument();
      expect(screen.queryByRole('option', { name: 'All alerts' })).not.toBeInTheDocument();
    });

    it('hides the dropdown but still lists alerts without permission to read alert rules', async () => {
      jest
        .spyOn(contextSrv, 'hasPermission')
        .mockImplementation((action: string) => action === AccessControlAction.AlertingInstanceRead);
      const requests = mockTeamLabelValues(['Team A']);
      mockAlerts([makeAlert({ labels: { alertname: 'CPU Critical', severity: 'critical' } })]);

      render(<AlertIncidentTabsWithData />);

      expect(await screen.findByText('CPU Critical')).toBeInTheDocument();
      expect(screen.queryByRole('combobox', { name: /filter alerts by label/i })).not.toBeInTheDocument();
      expect(requests).toEqual([]);
    });

    it.each([
      { name: 'no alert rule sets a label', mockRules: () => mockRuleLabels({}) },
      {
        name: 'the rules request fails',
        mockRules: () =>
          server.use(http.get(RULES_URL, () => HttpResponse.json({ message: 'Rules unavailable' }, { status: 500 }))),
      },
    ])('offers only the scope options when $name', async ({ mockRules }) => {
      mockRules();
      mockAlerts([makeAlert({ labels: { alertname: 'CPU Critical', severity: 'critical' } })]);

      const { user } = render(<AlertIncidentTabsWithData />);

      expect(await screen.findByText('CPU Critical')).toBeInTheDocument();
      await user.click(await screen.findByRole('combobox', { name: /filter alerts by label/i }));

      // This user belongs to no teams, so the unfiltered default is the only scope option.
      const options = await screen.findAllByRole('option');
      expect(options.map((option) => option.textContent)).toEqual(['All alerts']);
      expect(screen.queryByText('An error occurred while loading options.')).not.toBeInTheDocument();
    });

    it('sends a slug-style label value as-is and names it in the empty message', async () => {
      mockTeamLabelValues(['platform-monitoring']);
      // No alerts carry the selected team label, so the team-scoped empty copy shows.
      const requests = mockAlerts([]);

      const { user } = render(<AlertIncidentTabsWithData />);

      await user.click(await screen.findByRole('combobox', { name: /filter alerts by label/i }));
      await user.click(await screen.findByRole('option', { name: 'platform-monitoring' }));

      // The selected value is a real label value, so the matcher carries it verbatim.
      await waitFor(() => expect(requests).toContainEqual(['team="platform-monitoring"']));
      expect(await screen.findByText('No firing alerts with team=platform-monitoring.')).toBeInTheDocument();
    });

    it('groups values by label key and filters by a non-team label when one of its values is picked', async () => {
      mockRuleLabels({ team: 'Platform', severity: 'critical' }, { team: 'Platform', severity: 'warning' });
      const requests = mockAlerts([makeAlert({ labels: { alertname: 'CPU Critical', severity: 'critical' } })]);

      const { user } = render(<AlertIncidentTabsWithData />);

      expect(await screen.findByText('CPU Critical')).toBeInTheDocument();
      const combobox = await screen.findByRole('combobox', { name: /filter alerts by label/i });
      await user.click(combobox);

      // Values sit under a header naming their label key, keys sorted by name, values sorted within each.
      const options = await screen.findAllByRole('option');
      expect(options.map((option) => option.textContent)).toEqual(['All alerts', 'critical', 'warning', 'Platform']);
      expect(screen.getAllByTestId('combobox-option-group').map((header) => header.textContent)).toEqual([
        'severity',
        'team',
      ]);
      await user.click(screen.getByRole('option', { name: 'critical' }));

      // The matcher names the value's own label key, not `team`.
      await waitFor(() => expect(requests).toHaveLength(2));
      expect(requests[1]).toEqual(['severity="critical"']);
      expect(combobox).toHaveDisplayValue('critical');
    });

    // Which rule labels count is the API module's call; only whether a pick can be stored is checked here.
    it('does not offer labels whose key holds a colon', async () => {
      mockRuleLabels({ team: 'Team A' }, { 'team:name': 'Platform' });
      mockAlerts([makeAlert({ labels: { alertname: 'CPU Critical', severity: 'critical' } })]);

      const { user } = render(<AlertIncidentTabsWithData />);

      expect(await screen.findByText('CPU Critical')).toBeInTheDocument();
      await user.click(await screen.findByRole('combobox', { name: /filter alerts by label/i }));

      const options = await screen.findAllByRole('option');
      expect(options.map((option) => option.textContent)).toEqual(['All alerts', 'Team A']);
    });
  });

  describe('incidents filter dropdown', () => {
    it("offers the org's team field values and filters incidents to the picked team", async () => {
      jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(false);
      mockIrmPlugin();
      mockIncidentTeamField(['Team B', 'Team A']);
      const queries = mockIncidents([activeIncident]);

      const { user } = render(<AlertIncidentTabsWithData />);

      expect(await screen.findByText('Database outage')).toBeInTheDocument();
      expect(queries).toEqual([ACTIVE_INCIDENTS_QUERY]);

      const combobox = await screen.findByRole('combobox', { name: /filter incidents by label/i });
      expect(combobox).toHaveDisplayValue('All incidents');
      await user.click(combobox);

      // Incidents have no "your teams" scope, so "All incidents" is the only default option,
      // followed by the field values sorted by name. A single field gets no header.
      const options = await screen.findAllByRole('option');
      expect(options.map((option) => option.textContent)).toEqual(['All incidents', 'Team A', 'Team B']);
      expect(screen.queryByTestId('combobox-option-group')).not.toBeInTheDocument();
      await user.click(screen.getByRole('option', { name: 'Team B' }));

      // The pick becomes a custom-field clause on the incident query.
      await waitFor(() => expect(queries).toHaveLength(2));
      expect(queries[1]).toBe(`${ACTIVE_INCIDENTS_QUERY} field:team:"Team B"`);
      expect(combobox).toHaveDisplayValue('Team B');
    });

    // Two label fields, so the dropdown shows values under a header per field.
    function mockTeamAndSquadFields() {
      mockIncidentFields([
        { slug: 'team', name: 'Team', domainName: 'labels', selectoptions: [{ value: 'Platform' }] },
        {
          slug: 'squad',
          name: 'Squad',
          domainName: 'labels',
          selectoptions: [{ value: 'Frontend' }, { value: 'Backend' }],
        },
      ]);
    }

    it('groups values by field and filters by a non-team field when one of its values is picked', async () => {
      jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(false);
      mockIrmPlugin();
      mockTeamAndSquadFields();
      const queries = mockIncidents([activeIncident]);

      const { user } = render(<AlertIncidentTabsWithData />);

      expect(await screen.findByText('Database outage')).toBeInTheDocument();
      const combobox = await screen.findByRole('combobox', { name: /filter incidents by label/i });
      await user.click(combobox);

      // One dropdown for every label field: values sit under a header naming their field,
      // fields sorted by name, values sorted within each.
      const options = await screen.findAllByRole('option');
      expect(options.map((option) => option.textContent)).toEqual(['All incidents', 'Backend', 'Frontend', 'Platform']);
      expect(screen.getAllByTestId('combobox-option-group').map((header) => header.textContent)).toEqual([
        'Squad',
        'Team',
      ]);
      await user.click(screen.getByRole('option', { name: 'Frontend' }));

      // The clause names the value's own field, not `team`.
      await waitFor(() => expect(queries).toHaveLength(2));
      expect(queries[1]).toBe(`${ACTIVE_INCIDENTS_QUERY} field:squad:"Frontend"`);
      expect(combobox).toHaveDisplayValue('Frontend');
    });

    it('lists every value of a field when its name is typed', async () => {
      jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(false);
      mockIrmPlugin();
      mockTeamAndSquadFields();
      mockIncidents([activeIncident]);

      const { user } = render(<AlertIncidentTabsWithData />);

      expect(await screen.findByText('Database outage')).toBeInTheDocument();
      const combobox = await screen.findByRole('combobox', { name: /filter incidents by label/i });
      await user.click(combobox);
      expect(await screen.findByRole('option', { name: 'Platform' })).toBeInTheDocument();

      // "squ" matches no value, only the Squad header, so both squads stay and Platform goes.
      // keyboard() rather than type(): type() re-clicks the input, which toggles the menu closed.
      await user.keyboard('squ');
      await waitFor(() => expect(screen.queryByRole('option', { name: 'Platform' })).not.toBeInTheDocument());
      expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual(['Backend', 'Frontend']);
    });

    it('shows a stored pick by its value when its field is no longer offered', async () => {
      jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(false);
      mockIrmPlugin();
      // The `squad` field the selection names has since been archived away.
      mockIncidentTeamField(['Team A']);
      const queries = mockIncidents([]);

      render(<AlertIncidentTabsWithData initialIncidentsFilter="squad:Frontend" />);

      // The filter still applies, and the combobox reads "Frontend", not "squad:Frontend".
      await waitFor(() => expect(queries).toEqual([`${ACTIVE_INCIDENTS_QUERY} field:squad:"Frontend"`]));
      const combobox = await screen.findByRole('combobox', { name: /filter incidents by label/i });
      expect(combobox).toHaveDisplayValue('Frontend');
    });

    it('keeps the Alerts and Incidents team selections independent', async () => {
      mockTeams([{ name: 'Team A' }]);
      mockTeamLabelValues(['Team A', 'Team C']);
      const alertRequests = mockAlerts([makeAlert({ labels: { alertname: 'CPU Critical', severity: 'critical' } })]);
      mockIrmPlugin();
      // Team C exists only as an alert label, not as an incident field value.
      mockIncidentTeamField(['Team A', 'Team B']);
      const queries = mockIncidents([activeIncident]);

      const { user } = render(<AlertIncidentTabsWithData />);

      expect(await screen.findByText('CPU Critical')).toBeInTheDocument();
      await user.click(await screen.findByRole('combobox', { name: /filter alerts by label/i }));
      await user.click(await screen.findByRole('option', { name: 'Team C' }));
      await waitFor(() => expect(alertRequests).toHaveLength(2));
      expect(alertRequests[1]).toEqual(['team="Team C"']);

      await user.click(screen.getByRole('tab', { name: /incidents/i }));

      // The alerts pick doesn't leak into incidents, which can't hold that value anyway.
      const incidentsCombobox = await screen.findByRole('combobox', { name: /filter incidents by label/i });
      expect(incidentsCombobox).toHaveDisplayValue('All incidents');
      expect(queries).toEqual([ACTIVE_INCIDENTS_QUERY]);

      await user.click(incidentsCombobox);
      await user.click(await screen.findByRole('option', { name: 'Team B' }));
      await waitFor(() => expect(queries.at(-1)).toBe(`${ACTIVE_INCIDENTS_QUERY} field:team:"Team B"`));

      await user.click(screen.getByRole('tab', { name: /firing alerts/i }));

      // And the incidents pick doesn't disturb the alerts scope.
      expect(await screen.findByRole('combobox', { name: /filter alerts by label/i })).toHaveDisplayValue('Team C');
      expect(alertRequests).toHaveLength(2);
    });

    it('shows a team-scoped empty message when the selected team has no incidents', async () => {
      jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(false);
      mockIrmPlugin();
      mockIncidentTeamField(['Team A', 'Team B']);
      mockIncidents((queryString) => (queryString.includes('field:team:"Team B"') ? [] : [activeIncident]));

      const { user } = render(<AlertIncidentTabsWithData />);

      expect(await screen.findByText('Database outage')).toBeInTheDocument();
      await user.click(await screen.findByRole('combobox', { name: /filter incidents by label/i }));
      await user.click(await screen.findByRole('option', { name: 'Team B' }));

      expect(await screen.findByText('No active incidents for Team B.')).toBeInTheDocument();
      expect(screen.queryByText('Database outage')).not.toBeInTheDocument();
    });

    it('hides the dropdown when the org has no label fields', async () => {
      jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(false);
      mockIrmPlugin();
      // Which fields count as labels is the API module's call (see incidentsApi.test.ts); here it's just "nothing to pick".
      mockNoIncidentFields();
      mockIncidents([activeIncident]);

      render(<AlertIncidentTabsWithData />);

      expect(await screen.findByText('Database outage')).toBeInTheDocument();
      expect(screen.queryByRole('combobox', { name: /filter incidents by label/i })).not.toBeInTheDocument();
    });

    it('hides the dropdown but still lists incidents when the fields request fails', async () => {
      jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(false);
      mockIrmPlugin();
      server.use(http.post(GET_FIELDS_PATH, () => new HttpResponse(null, { status: 404 })));
      mockIncidents([activeIncident]);

      render(<AlertIncidentTabsWithData />);

      expect(await screen.findByText('Database outage')).toBeInTheDocument();
      expect(screen.queryByRole('combobox', { name: /filter incidents by label/i })).not.toBeInTheDocument();
      expect(screen.queryByText('Could not load active incidents')).not.toBeInTheDocument();
    });
  });
});
