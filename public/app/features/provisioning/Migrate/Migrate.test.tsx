import { HttpResponse, delay, http } from 'msw';
import { render, screen, waitFor } from 'test/test-utils';

import { type DashboardHit } from '@grafana/api-clients/rtkq/dashboard/v0alpha1';
import { getCustomSearchHandler, PROVISIONING_API_BASE as BASE, searchRoute } from '@grafana/test-utils/handlers';
import server from '@grafana/test-utils/server';
import { type ResourceStats } from 'app/api/clients/provisioning/v0alpha1';

import { createRepository } from '../mocks/factories';
import { setupProvisioningMswServer } from '../mocks/server';

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

  it('renders the folder cards when there are folders but no dashboards', async () => {
    respondWithStats({
      instance: [{ group: 'folder.grafana.app', resource: 'folders', count: 4 }],
      managed: [{ kind: 'repo', stats: [{ group: 'folder.grafana.app', resource: 'folders', count: 1 }] }],
    });

    render(<Migrate />);

    // Not the empty state — folders are still migration targets. Both the
    // Folders and All resources cards read "1 of 4 managed".
    expect(await screen.findByText('Folders')).toBeInTheDocument();
    expect(screen.getByText('All resources')).toBeInTheDocument();
    expect(screen.getAllByText('1 of 4 managed')).toHaveLength(2);
    expect(screen.queryByText(/no provisioned resources yet/i)).not.toBeInTheDocument();
    // No dashboards, so that card is hidden.
    expect(screen.queryByText('Dashboards')).not.toBeInTheDocument();
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

    it('renders a status card per resource type plus a combined "All resources" card', async () => {
      render(<Migrate />);

      // Dashboards: 50 of 100 managed.
      expect(await screen.findByText('Dashboards')).toBeInTheDocument();
      expect(screen.getByText('50 of 100 managed')).toBeInTheDocument();

      // Folders: 6 of 8 managed.
      expect(screen.getByText('Folders')).toBeInTheDocument();
      expect(screen.getByText('6 of 8 managed')).toBeInTheDocument();

      // All resources: 56 of 108 managed.
      expect(screen.getByText('All resources')).toBeInTheDocument();
      expect(screen.getByText('56 of 108 managed')).toBeInTheDocument();
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
      expect(await screen.findByText(/all folders and resources will be migrated/i)).toBeInTheDocument();
    });

    it('offers a connect action instead of migrate when no write-capable repo is connected', async () => {
      // A PR-only repo can't run a migration, matching the drawer's guard.
      respondWithRepositories([createRepository({ metadata: { name: 'pr-only' }, spec: { workflows: ['branch'] } })]);
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

      expect(await screen.findByText(/all folders and resources will be migrated/i)).toBeInTheDocument();
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
      expect(screen.queryByText(/all folders and resources will be migrated/i)).not.toBeInTheDocument();
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

    expect(await screen.findByText('All folders are already managed.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /migrate (selected|all)/i })).not.toBeInTheDocument();
  });
});
