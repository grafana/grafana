import { HttpResponse, http } from 'msw';
import { act, render, screen, waitFor } from 'test/test-utils';

import { PROVISIONING_API_BASE as BASE } from '@grafana/test-utils/handlers';
import server from '@grafana/test-utils/server';
import { type Repository } from 'app/api/clients/provisioning/v0alpha1';

import { createJob, createRepository } from '../mocks/factories';
import { getMockLiveSrv, setupProvisioningMswServer } from '../mocks/server';

import { MigrateDrawer } from './MigrateDrawer';

setupProvisioningMswServer();

// Migration needs the `write` workflow (push to the configured branch), so
// repos default to it; pass other workflows to exercise the blocked path.
function makeRepo(name: string, title: string, workflows: Array<'branch' | 'write'> = ['write']): Repository {
  return createRepository({ metadata: { name }, spec: { title, workflows } });
}

function mockCreateJob(job = createJob()) {
  server.use(http.post(`${BASE}/repositories/:name/jobs`, () => HttpResponse.json(job)));
}

function mockJobList(job = createJob()) {
  server.use(http.get(`${BASE}/jobs`, () => HttpResponse.json({ items: [job], metadata: { resourceVersion: '1' } })));
}

function mockRepositoryLookup(repository = createRepository()) {
  server.use(http.get(`${BASE}/repositories/:name`, () => HttpResponse.json(repository)));
}

describe('MigrateDrawer', () => {
  it('pre-selects the repository when exactly one is connected', async () => {
    render(<MigrateDrawer selective={false} repos={[makeRepo('repo-1', 'My only repo')]} onDismiss={jest.fn()} />);

    expect(await screen.findByRole('combobox')).toHaveValue('My only repo');
  });

  it('keeps the migrate button disabled until a repository is selected', async () => {
    render(
      <MigrateDrawer
        selective={false}
        repos={[makeRepo('a', 'Repo A'), makeRepo('b', 'Repo B')]}
        onDismiss={jest.fn()}
      />
    );

    // The button keeps a tooltip while disabled, so Grafana renders it with
    // aria-disabled rather than the native disabled attribute.
    expect(await screen.findByRole('button', { name: /migrate everything/i })).toHaveAttribute('aria-disabled', 'true');
  });

  it('calls onDismiss when cancelled', async () => {
    const onDismiss = jest.fn();
    const { user } = render(
      <MigrateDrawer selective={false} repos={[makeRepo('repo-1', 'My only repo')]} onDismiss={onDismiss} />
    );

    await user.click(await screen.findByRole('button', { name: /cancel/i }));

    expect(onDismiss).toHaveBeenCalled();
  });

  it('blocks migration and warns when the repository cannot push to its configured branch', async () => {
    // A PR-only repository (no `write` workflow) can't run a migration.
    render(
      <MigrateDrawer
        selective={false}
        repos={[makeRepo('pr-only', 'PR only repo', ['branch'])]}
        onDismiss={jest.fn()}
      />
    );

    expect(await screen.findByText(/be used for migration/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /migrate everything/i })).toHaveAttribute('aria-disabled', 'true');
  });

  it('tailors the limitations alert to the repository sync target', async () => {
    const instanceRepo = createRepository({
      metadata: { name: 'inst' },
      spec: { title: 'Instance repo', workflows: ['write'], sync: { target: 'instance', enabled: true } },
    });
    const { unmount } = render(<MigrateDrawer selective={false} repos={[instanceRepo]} onDismiss={jest.fn()} />);
    // Instance sync loses alerts/library panels.
    expect(await screen.findByText(/existing alerts and library panels will be lost/i)).toBeInTheDocument();
    unmount();

    const folderRepo = createRepository({
      metadata: { name: 'fold' },
      spec: { title: 'Folder repo', workflows: ['write'], sync: { target: 'folder', enabled: true } },
    });
    render(<MigrateDrawer selective={false} repos={[folderRepo]} onDismiss={jest.fn()} />);
    // Folder sync replicates the folder structure and does NOT lose alerts instance-wide.
    expect(await screen.findByText(/folder structure will be replicated/i)).toBeInTheDocument();
    expect(screen.queryByText(/existing alerts and library panels will be lost/i)).not.toBeInTheDocument();
  });

  it('runs a migrate job and shows its progress', async () => {
    let postedBody = '';
    server.use(
      http.post(`${BASE}/repositories/:name/jobs`, async ({ request }) => {
        postedBody = await request.text();
        return HttpResponse.json(createJob());
      })
    );
    mockJobList(createJob());

    const { user } = render(
      <MigrateDrawer selective={false} repos={[makeRepo('repo-1', 'My only repo')]} onDismiss={jest.fn()} />
    );
    await user.click(screen.getByRole('button', { name: /migrate everything/i }));

    expect(await screen.findByText('Pulling...')).toBeInTheDocument();
    // It must be a migrate job (not a plain pull).
    expect(postedBody).toContain('"action":"migrate"');
    // Folder UIDs are always regenerated so the migration creates new folders.
    expect(postedBody).toContain('"generateNewFolderIDs":true');
    // The selection form is replaced by the job view.
    expect(screen.queryByText(/target repository/i)).not.toBeInTheDocument();
  });

  it('notifies onMigrated once the migration completes', async () => {
    const onMigrated = jest.fn();
    mockCreateJob(createJob());
    mockJobList(createJob());
    mockRepositoryLookup();

    const { user } = render(
      <MigrateDrawer
        selective={false}
        repos={[makeRepo('repo-1', 'My only repo')]}
        onDismiss={jest.fn()}
        onMigrated={onMigrated}
      />
    );
    await user.click(screen.getByRole('button', { name: /migrate everything/i }));

    expect(await screen.findByText('Pulling...')).toBeInTheDocument();

    act(() => {
      getMockLiveSrv().emitWatchEvent('jobs', {
        type: 'MODIFIED',
        object: createJob({ status: { state: 'success' } }),
      });
    });

    await waitFor(() => expect(onMigrated).toHaveBeenCalledTimes(1));
  });

  describe('selective migration', () => {
    const resources = [
      { name: 'dash-1', group: 'dashboard.grafana.app', kind: 'Dashboard' },
      { name: 'dash-2', group: 'dashboard.grafana.app', kind: 'Dashboard' },
    ];

    it('labels the action "Migrate selected" and summarizes the selection', async () => {
      render(
        <MigrateDrawer
          selective
          repos={[makeRepo('repo-1', 'My only repo')]}
          resources={resources}
          selection={{ folders: 1, resources: 2 }}
          onDismiss={jest.fn()}
        />
      );

      expect(await screen.findByRole('button', { name: /migrate selected/i })).toBeInTheDocument();
      // The "migrate everything" copy must not show in selective mode.
      expect(screen.queryByText(/all resources not yet managed by git will be migrated/i)).not.toBeInTheDocument();
      expect(screen.getByText(/2 selected resources/i)).toBeInTheDocument();
    });

    it('disables migration in selective mode when there are no resources to send', async () => {
      // Guards against a selective click collapsing to migrate-everything.
      render(
        <MigrateDrawer
          selective
          repos={[makeRepo('repo-1', 'My only repo')]}
          resources={[]}
          selection={{ folders: 0, resources: 0 }}
          onDismiss={jest.fn()}
        />
      );

      expect(await screen.findByRole('button', { name: /migrate selected/i })).toHaveAttribute('aria-disabled', 'true');
    });

    it('runs a migrate job scoped to the selected dashboard resources', async () => {
      let postedBody = '';
      server.use(
        http.post(`${BASE}/repositories/:name/jobs`, async ({ request }) => {
          postedBody = await request.text();
          return HttpResponse.json(createJob());
        })
      );
      mockJobList(createJob());

      const { user } = render(
        <MigrateDrawer
          selective
          repos={[makeRepo('repo-1', 'My only repo')]}
          resources={resources}
          selection={{ folders: 1, resources: 2 }}
          onDismiss={jest.fn()}
        />
      );
      await user.click(screen.getByRole('button', { name: /migrate selected/i }));

      expect(await screen.findByText('Pulling...')).toBeInTheDocument();
      expect(postedBody).toContain('"action":"migrate"');
      // Folder UIDs are regenerated in selective migrations too.
      expect(postedBody).toContain('"generateNewFolderIDs":true');
      // The selected dashboard refs are forwarded to the migrate job.
      expect(postedBody).toContain('"resources"');
      expect(postedBody).toContain('dash-1');
      expect(postedBody).toContain('dash-2');
    });
  });
});
