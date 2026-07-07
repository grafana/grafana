import { HttpResponse, delay, http } from 'msw';
import { act, render, screen, waitFor } from 'test/test-utils';

import { type DashboardHit } from '@grafana/api-clients/rtkq/dashboard/v0alpha1';
import { getCustomSearchHandler, PROVISIONING_API_BASE as BASE, searchRoute } from '@grafana/test-utils/handlers';
import server from '@grafana/test-utils/server';
import { type ResourceStats } from 'app/api/clients/provisioning/v0alpha1';

import { createJob, createRepository } from '../mocks/factories';
import { getMockLiveSrv, setupProvisioningMswServer } from '../mocks/server';

import { Migrate } from './Migrate';

setupProvisioningMswServer();

// The folder list, the repository list and the stats are all served through MSW
// so the page runs against the real hooks.
function folderHit(name: string, title: string, parent = ''): DashboardHit {
  return { resource: 'folders', name, title, folder: parent, field: {} };
}

function dashboardHit(name: string, title: string, parent: string): DashboardHit {
  return { resource: 'dashboards', name, title, folder: parent, field: {} };
}

function respondWithSearch(hits: DashboardHit[] = []) {
  server.use(getCustomSearchHandler(hits));
}

function respondWithRepositories(
  items = [createRepository({ metadata: { name: 'repo-1' }, spec: { workflows: ['write'] } })]
) {
  server.use(http.get(`${BASE}/repositories`, () => HttpResponse.json({ items })));
}

beforeEach(() => {
  // Empty folder list by default; table tests provide their own hits.
  respondWithSearch();
  // One connected repository (able to push to its configured branch) by default
  // so the migrate actions are enabled.
  respondWithRepositories();
});

// 100 dashboards total, 40 managed by Git Sync, 10 by Terraform => 50 managed,
// 50 unmanaged. 8 folders total, 6 managed (4 git sync + 2 terraform).
const stats: ResourceStats = {
  instance: [
    { group: 'dashboard.grafana.app', resource: 'dashboards', count: 100 },
    { group: 'folder.grafana.app', resource: 'folders', count: 8 },
  ],
  managed: [
    {
      kind: 'repo',
      stats: [
        { group: 'dashboard.grafana.app', resource: 'dashboards', count: 40 },
        { group: 'folder.grafana.app', resource: 'folders', count: 4 },
      ],
    },
    {
      kind: 'terraform',
      stats: [
        { group: 'dashboard.grafana.app', resource: 'dashboards', count: 10 },
        { group: 'folder.grafana.app', resource: 'folders', count: 2 },
      ],
    },
  ],
};

function respondWithStats(response: ResourceStats) {
  server.use(http.get(`${BASE}/stats`, () => HttpResponse.json(response)));
}

const PLAYLISTS_ROUTE = '/apis/playlist.grafana.app/v1/namespaces/:namespace/playlists';

// Enable the playlist kind in the settings endpoint's `availableResources` and
// serve the playlist list. Without this the Migrate page stays dashboard-only.
function enablePlaylists(playlistTitles: Array<{ name: string; title: string }> = []) {
  server.use(
    http.get(`${BASE}/settings`, () =>
      HttpResponse.json({
        items: [],
        allowImageRendering: true,
        availableResources: [
          { group: 'dashboard.grafana.app', kind: 'Dashboard' },
          { group: 'playlist.grafana.app', kind: 'Playlist' },
        ],
      })
    )
  );
  server.use(
    http.get(PLAYLISTS_ROUTE, () =>
      HttpResponse.json({
        items: playlistTitles.map(({ name, title }) => ({
          metadata: { name },
          spec: { title, interval: '5m', items: [] },
        })),
        metadata: {},
      })
    )
  );
}

describe('Migrate', () => {
  it('renders a loading spinner while stats are loading', () => {
    server.use(
      http.get(`${BASE}/stats`, async () => {
        await delay('infinite');
        return HttpResponse.json(stats);
      })
    );

    render(<Migrate />);

    expect(screen.getByText(/loading stats/i)).toBeInTheDocument();
  });

  it('renders an error alert when the stats query fails', async () => {
    server.use(http.get(`${BASE}/stats`, () => HttpResponse.json({ message: 'boom' }, { status: 500 })));

    render(<Migrate />);

    expect(await screen.findByText(/failed to load provisioning stats/i)).toBeInTheDocument();
  });

  it('renders an empty state only when there are no resources at all', async () => {
    respondWithStats({ instance: [], managed: [] });

    render(<Migrate />);

    expect(await screen.findByText(/no provisioned resources yet/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /migrate to gitops/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /start migration/i })).not.toBeInTheDocument();
  });

  it('renders the dashboard-centric overview when there are folders but no dashboards', async () => {
    respondWithStats({
      instance: [{ group: 'folder.grafana.app', resource: 'folders', count: 4 }],
      managed: [{ kind: 'repo', stats: [{ group: 'folder.grafana.app', resource: 'folders', count: 1 }] }],
    });

    render(<Migrate />);

    // Not the empty state — there are still folders to surface in the table.
    expect(await screen.findByText('Resources to migrate')).toBeInTheDocument();
    expect(screen.queryByText(/no provisioned resources yet/i)).not.toBeInTheDocument();
    // The overview is dashboard-centric: no dashboards means no Dashboards card,
    // and the folder/combined-total cards stay gone.
    expect(screen.queryByText('Dashboards')).not.toBeInTheDocument();
    expect(screen.queryByText('Folders')).not.toBeInTheDocument();
    expect(screen.queryByText('All resources')).not.toBeInTheDocument();
  });

  describe('with unmanaged resources', () => {
    beforeEach(() => {
      respondWithStats(stats);
    });

    it('renders the header with an experimental badge', async () => {
      render(<Migrate />);

      expect(await screen.findByRole('heading', { name: /migrate to gitops/i })).toBeInTheDocument();
      expect(screen.getByText(/^experimental$/i)).toBeInTheDocument();
    });

    it('renders the overview while the resource table is still loading', async () => {
      // The folder enumeration never resolves; the header + KPI cards must not
      // wait on it.
      server.use(
        http.get(searchRoute, async () => {
          await delay('infinite');
          return HttpResponse.json({ totalHits: 0, hits: [] });
        })
      );

      render(<Migrate />);

      expect(await screen.findByText('Dashboards')).toBeInTheDocument();
      expect(screen.getByText(/loading resources/i)).toBeInTheDocument();
    });

    it('shows only the dashboards card in the overview', async () => {
      render(<Migrate />);

      // Dashboards: 50 of 100 managed.
      expect(await screen.findByText('Dashboards')).toBeInTheDocument();
      expect(screen.getByText('50 of 100 managed')).toBeInTheDocument();

      // The standalone Folders, combined "All resources" and folders-to-migrate
      // cards are all gone — the overview is dashboard-only.
      expect(screen.queryByText('Folders')).not.toBeInTheDocument();
      expect(screen.queryByText('All resources')).not.toBeInTheDocument();
      expect(screen.queryByText('Folders to migrate')).not.toBeInTheDocument();
    });

    it('migrates everything via select-all and the Migrate all button', async () => {
      respondWithSearch([
        folderHit('team-a', 'Team A'),
        dashboardHit('d1', 'Dashboard One', 'team-a'),
        dashboardHit('d2', 'Dashboard Two', 'team-a'),
      ]);

      const { user } = render(<Migrate />);

      // Select-all flips the action to the explicit "Migrate all" everything flow.
      await user.click(await screen.findByRole('checkbox', { name: /select all/i }));
      const migrateAll = await screen.findByRole('button', { name: /migrate all \(1\)/i });
      // The repository list loads async; wait until the action is enabled.
      await waitFor(() => expect(migrateAll).toBeEnabled());
      await user.click(migrateAll);

      // The drawer opens in the everything mode, not the selective summary.
      expect(await screen.findByText(/all resources not yet managed by git will be migrated/i)).toBeInTheDocument();
    });

    it('closes the migrate drawer when it is dismissed', async () => {
      respondWithSearch([folderHit('team-a', 'Team A'), dashboardHit('d1', 'Dashboard One', 'team-a')]);

      const { user } = render(<Migrate />);

      await user.click(await screen.findByRole('checkbox', { name: /select all/i }));
      const migrateAll = await screen.findByRole('button', { name: /migrate all \(1\)/i });
      await waitFor(() => expect(migrateAll).toBeEnabled());
      await user.click(migrateAll);

      const drawerText = /all resources not yet managed by git will be migrated/i;
      expect(await screen.findByText(drawerText)).toBeInTheDocument();

      // Cancelling dismisses the drawer.
      await user.click(screen.getByRole('button', { name: /cancel/i }));
      await waitFor(() => expect(screen.queryByText(drawerText)).not.toBeInTheDocument());
    });

    it('still offers the migrate action when the only connected repo cannot push', async () => {
      // A PR-only repo can't run a migration, but the flow stays reachable so the
      // drawer can explain how to enable it — rather than hiding it behind Configure.
      respondWithRepositories([createRepository({ metadata: { name: 'pr-only' }, spec: { workflows: ['branch'] } })]);
      respondWithSearch([folderHit('team-a', 'Team A'), dashboardHit('d1', 'Dashboard One', 'team-a')]);

      render(<Migrate />);

      expect(await screen.findByText('Team A')).toBeInTheDocument();
      expect(await screen.findByRole('button', { name: /migrate (all|selected)/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /configure/i })).not.toBeInTheDocument();
    });

    it('offers a connect action in the footer when no repository is connected', async () => {
      respondWithRepositories([]);
      respondWithSearch([folderHit('team-a', 'Team A'), dashboardHit('d1', 'Dashboard One', 'team-a')]);

      render(<Migrate />);

      expect(await screen.findByText('Team A')).toBeInTheDocument();
      expect(await screen.findByRole('button', { name: /configure/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /migrate (all|selected)/i })).not.toBeInTheDocument();
    });

    it('still offers migrate-everything when the resource list fails to load', async () => {
      server.use(http.get(searchRoute, () => HttpResponse.json({ message: 'boom' }, { status: 500 })));

      const { user } = render(<Migrate />);

      // The folder list errored, but the stats-driven migrate-everything stays
      // reachable (it doesn't need the enumeration).
      expect(await screen.findByText(/could not load the list of resources/i)).toBeInTheDocument();
      const migrateEverything = await screen.findByRole('button', { name: /migrate everything/i });
      await waitFor(() => expect(migrateEverything).toBeEnabled());
      await user.click(migrateEverything);

      expect(await screen.findByText(/all resources not yet managed by git will be migrated/i)).toBeInTheDocument();
    });

    it('offers a connect action on the resource-list-error fallback when no repository is connected', async () => {
      respondWithRepositories([]);
      server.use(http.get(searchRoute, () => HttpResponse.json({ message: 'boom' }, { status: 500 })));

      render(<Migrate />);

      expect(await screen.findByText(/could not load the list of resources/i)).toBeInTheDocument();
      expect(await screen.findByRole('button', { name: /configure/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /migrate everything/i })).not.toBeInTheDocument();
    });

    it('lists unmanaged folders in the Resources to migrate table', async () => {
      respondWithSearch([
        folderHit('team-a', 'Team A'),
        dashboardHit('d1', 'Dashboard One', 'team-a'),
        dashboardHit('d2', 'Dashboard Two', 'team-a'),
      ]);

      render(<Migrate />);

      expect(await screen.findByText('Resources to migrate')).toBeInTheDocument();
      expect(await screen.findByText('Team A')).toBeInTheDocument();
    });

    it('opens the drawer scoped to the selection when migrating selected folders', async () => {
      // Two folders so picking one is a partial selection ("Migrate selected"),
      // not the everything flow.
      respondWithSearch([
        folderHit('team-a', 'Team A'),
        dashboardHit('d1', 'Dashboard One', 'team-a'),
        dashboardHit('d2', 'Dashboard Two', 'team-a'),
        folderHit('team-b', 'Team B'),
        dashboardHit('d3', 'Dashboard Three', 'team-b'),
      ]);

      const { user } = render(<Migrate />);

      // Picking just one folder cascades to its two dashboards.
      await user.click(await screen.findByRole('checkbox', { name: /select folder team a/i }));
      const migrateSelected = await screen.findByRole('button', { name: /migrate selected \(1\)/i });
      // The repository list loads async; wait until the action is enabled.
      await waitFor(() => expect(migrateSelected).toBeEnabled());
      await user.click(migrateSelected);

      // The drawer opens in selective mode summarizing the two resources.
      expect(await screen.findByText(/2 selected resources/i)).toBeInTheDocument();
      expect(screen.queryByText(/all resources not yet managed by git will be migrated/i)).not.toBeInTheDocument();
    });

    it('selects an individual dashboard inside a folder', async () => {
      respondWithSearch([
        folderHit('team-a', 'Team A'),
        dashboardHit('d1', 'Dashboard One', 'team-a'),
        dashboardHit('d2', 'Dashboard Two', 'team-a'),
      ]);

      const { user } = render(<Migrate />);

      await user.click(await screen.findByRole('button', { name: /expand team a/i }));
      await user.click(screen.getByRole('checkbox', { name: 'Dashboard One' }));

      // Ticking one dashboard (not the whole folder) is a selection of one.
      expect(await screen.findByRole('button', { name: /migrate selected \(1\)/i })).toBeInTheDocument();
    });

    it('clears the selection and refetches after a successful migration', async () => {
      // Count folder-list fetches via the request emitter so the real search
      // handler still serves the response; onMigrated should trigger a refetch.
      let searchCalls = 0;
      const countSearch = ({ request }: { request: Request }) => {
        if (new URL(request.url).pathname.endsWith('/search')) {
          searchCalls += 1;
        }
      };
      server.events.on('request:start', countSearch);

      respondWithSearch([folderHit('team-a', 'Team A'), dashboardHit('d1', 'Dashboard One', 'team-a')]);
      server.use(http.post(`${BASE}/repositories/:name/jobs`, () => HttpResponse.json(createJob())));
      server.use(
        http.get(`${BASE}/jobs`, () => HttpResponse.json({ items: [createJob()], metadata: { resourceVersion: '1' } }))
      );
      server.use(http.get(`${BASE}/repositories/:name`, () => HttpResponse.json(createRepository())));

      try {
        const { user } = render(<Migrate />);

        await user.click(await screen.findByRole('checkbox', { name: /select folder team a/i }));
        const migrateAll = await screen.findByRole('button', { name: /migrate all \(1\)/i });
        await waitFor(() => expect(migrateAll).toBeEnabled());
        await user.click(migrateAll);

        // Confirm in the drawer to actually start the job.
        const confirm = await screen.findByRole('button', { name: /migrate everything/i });
        await waitFor(() => expect(confirm).toBeEnabled());
        await user.click(confirm);

        await screen.findByText('Pulling...');
        const callsBeforeSuccess = searchCalls;

        act(() => {
          getMockLiveSrv().emitWatchEvent('jobs', {
            type: 'MODIFIED',
            object: createJob({ status: { state: 'success' } }),
          });
        });

        await waitFor(() => expect(searchCalls).toBeGreaterThan(callsBeforeSuccess));
      } finally {
        server.events.removeListener('request:start', countSearch);
      }
    });

    it('deselects a folder when its checkbox is toggled again', async () => {
      respondWithSearch([
        folderHit('team-a', 'Team A'),
        dashboardHit('d1', 'Dashboard One', 'team-a'),
        folderHit('team-b', 'Team B'),
        dashboardHit('d2', 'Dashboard Two', 'team-b'),
      ]);

      const { user } = render(<Migrate />);

      const checkbox = await screen.findByRole('checkbox', { name: /select folder team a/i });
      await user.click(checkbox); // select
      expect(await screen.findByRole('button', { name: /migrate selected \(1\)/i })).toBeInTheDocument();

      await user.click(checkbox); // deselect — back to nothing selected
      expect(await screen.findByRole('button', { name: /migrate selected \(0\)/i })).toBeDisabled();
    });
  });

  describe('with playlists enabled', () => {
    // Dashboards + playlists both reported by stats, both with unmanaged items.
    const withPlaylists: ResourceStats = {
      instance: [
        { group: 'dashboard.grafana.app', resource: 'dashboards', count: 100 },
        { group: 'folder.grafana.app', resource: 'folders', count: 8 },
        { group: 'playlist.grafana.app', resource: 'playlists', count: 20 },
      ],
      managed: [
        {
          kind: 'repo',
          stats: [
            { group: 'dashboard.grafana.app', resource: 'dashboards', count: 40 },
            { group: 'playlist.grafana.app', resource: 'playlists', count: 5 },
          ],
        },
      ],
    };

    it('shows the playlists and combined cards plus a synthetic Playlists folder', async () => {
      respondWithStats(withPlaylists);
      enablePlaylists([
        { name: 'p1', title: 'Morning rotation' },
        { name: 'p2', title: 'Ops wall' },
      ]);

      const { user } = render(<Migrate />);

      // Per-kind cards plus the combined "All resources" card. "Playlists"
      // appears both as a card and as the synthetic folder title.
      expect(await screen.findByText('Dashboards')).toBeInTheDocument();
      expect(screen.getAllByText('Playlists').length).toBeGreaterThan(0);
      expect(screen.getByText('All resources')).toBeInTheDocument();

      // The playlists are grouped under a synthetic "Playlists" folder; expand
      // it to reveal the individual selectable playlist rows.
      await user.click(await screen.findByRole('button', { name: /expand playlists/i }));
      expect(await screen.findByText('Morning rotation')).toBeInTheDocument();
      expect(screen.getByText('Ops wall')).toBeInTheDocument();
    });

    it('warns and keeps select-all selective when a kind fails to enumerate', async () => {
      respondWithStats(withPlaylists);
      enablePlaylists();
      // The playlist apiserver list fails (500, not a 404 fallback), so the
      // playlist kind can't be enumerated while dashboards load fine.
      server.use(http.get(PLAYLISTS_ROUTE, () => HttpResponse.json({ message: 'boom' }, { status: 500 })));
      respondWithSearch([folderHit('team-a', 'Team A'), dashboardHit('d1', 'Dashboard One', 'team-a')]);

      const { user } = render(<Migrate />);

      // The incomplete list is surfaced rather than silently dropped...
      expect(await screen.findByText(/some resource types could not be loaded/i)).toBeInTheDocument();
      // ...and the dashboards that did load are still shown.
      expect(await screen.findByText('Team A')).toBeInTheDocument();

      // Selecting every displayed row stays a SELECTIVE migration — it must not
      // escalate to migrate-everything and pull in the un-shown playlists.
      await user.click(await screen.findByRole('checkbox', { name: /select all/i }));
      expect(await screen.findByRole('button', { name: /migrate selected/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /migrate all/i })).not.toBeInTheDocument();
    });

    it('keeps an explicit migrate-everything action in the partial-failure warning', async () => {
      respondWithStats(withPlaylists);
      enablePlaylists();
      server.use(http.get(PLAYLISTS_ROUTE, () => HttpResponse.json({ message: 'boom' }, { status: 500 })));
      respondWithSearch([folderHit('team-a', 'Team A'), dashboardHit('d1', 'Dashboard One', 'team-a')]);

      const { user } = render(<Migrate />);

      await screen.findByText(/some resource types could not be loaded/i);
      const migrateEverything = await screen.findByRole('button', { name: /migrate everything/i });
      await waitFor(() => expect(migrateEverything).toBeEnabled());
      await user.click(migrateEverything);

      expect(await screen.findByText(/all resources not yet managed by git will be migrated/i)).toBeInTheDocument();
    });

    it('offers a connect action in the partial-failure warning when no repository is connected', async () => {
      respondWithStats(withPlaylists);
      enablePlaylists();
      server.use(http.get(PLAYLISTS_ROUTE, () => HttpResponse.json({ message: 'boom' }, { status: 500 })));
      respondWithRepositories([]);
      respondWithSearch([folderHit('team-a', 'Team A'), dashboardHit('d1', 'Dashboard One', 'team-a')]);

      render(<Migrate />);

      expect(await screen.findByText(/some resource types could not be loaded/i)).toBeInTheDocument();
      // A connect action replaces the migrate-everything button (the table footer
      // also surfaces one, hence findAll).
      expect((await screen.findAllByRole('button', { name: /configure/i })).length).toBeGreaterThan(0);
      expect(screen.queryByRole('button', { name: /migrate everything/i })).not.toBeInTheDocument();
    });

    it('migrates a selected playlist via a selective job', async () => {
      respondWithStats(withPlaylists);
      // Two playlists so ticking one is a partial (selective) selection rather
      // than "select everything".
      enablePlaylists([
        { name: 'p1', title: 'Morning rotation' },
        { name: 'p2', title: 'Ops wall' },
      ]);

      let postedBody = '';
      server.use(
        http.post(`${BASE}/repositories/:name/jobs`, async ({ request }) => {
          postedBody = await request.text();
          return HttpResponse.json(createJob());
        })
      );
      server.use(
        http.get(`${BASE}/jobs`, () => HttpResponse.json({ items: [createJob()], metadata: { resourceVersion: '1' } }))
      );

      const { user } = render(<Migrate />);

      // Expand the synthetic Playlists folder, then tick a single playlist —
      // a partial selection (two exist), so it's a selective migrate.
      await user.click(await screen.findByRole('button', { name: /expand playlists/i }));
      await user.click(await screen.findByRole('checkbox', { name: 'Morning rotation' }));
      const migrateSelected = await screen.findByRole('button', { name: /migrate selected \(1\)/i });
      await waitFor(() => expect(migrateSelected).toBeEnabled());
      await user.click(migrateSelected);

      // The table footer button reads "Migrate selected (1)"; match the drawer's
      // confirm button, whose label has no count.
      const confirm = await screen.findByRole('button', { name: /^migrate selected$/i });
      await waitFor(() => expect(confirm).toBeEnabled());
      await user.click(confirm);

      await screen.findByText('Pulling...');
      expect(postedBody).toContain('"action":"migrate"');
      expect(postedBody).toContain('"kind":"Playlist"');
      expect(postedBody).toContain('p1');
    });
  });

  it('shows the all-managed empty state and no migrate action when nothing is unmanaged', async () => {
    respondWithStats({
      instance: [
        { group: 'dashboard.grafana.app', resource: 'dashboards', count: 10 },
        { group: 'folder.grafana.app', resource: 'folders', count: 2 },
      ],
      managed: [
        {
          kind: 'repo',
          stats: [
            { group: 'dashboard.grafana.app', resource: 'dashboards', count: 10 },
            { group: 'folder.grafana.app', resource: 'folders', count: 2 },
          ],
        },
      ],
    });
    // No migratable folders, so the table shows its all-managed empty state.
    respondWithSearch([]);

    render(<Migrate />);

    expect(await screen.findByText('All supported resources are already managed by Git.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /migrate (selected|all)/i })).not.toBeInTheDocument();
  });
});
