import { HttpResponse, http } from 'msw';
import { act, render, screen, waitFor } from 'test/test-utils';

import { PROVISIONING_API_BASE as BASE } from '@grafana/test-utils/handlers';
import server from '@grafana/test-utils/server';
import { type Repository } from 'app/api/clients/provisioning/v0alpha1';

import { createJob, createRepository } from '../mocks/factories';
import { getMockLiveSrv, setupProvisioningMswServer } from '../mocks/server';

import { MigrateDrawer } from './MigrateDrawer';

setupProvisioningMswServer();

// Migration needs a write-capable workflow — `write` (direct commit) or
// `branch` (pull request). Repos default to `write`; pass `[]` to exercise the
// read-only/blocked path or `['branch']` for the pull-request path.
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
  it('pre-selects the repository when exactly one usable one is connected', async () => {
    render(<MigrateDrawer selective={false} repos={[makeRepo('repo-1', 'My only repo')]} onDismiss={jest.fn()} />);

    expect(await screen.findByText('My only repo')).toBeInTheDocument();
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

  it('auto-generates the target branch for a branch-only repository', async () => {
    // A branch-only repository migrates through a pull request, so pushing to a
    // branch is mandatory: the checkbox is checked and disabled, and the
    // read-only branch is generated for the user (prefixed `migrate-<repo>`).
    render(
      <MigrateDrawer
        selective={false}
        repos={[makeRepo('pr-only', 'PR only repo', ['branch'])]}
        onDismiss={jest.fn()}
      />
    );

    expect(await screen.findByRole('button', { name: /migrate everything/i })).toBeEnabled();

    const checkbox = screen.getByRole('checkbox', { name: /push changes to a branch/i });
    expect(checkbox).toBeChecked();
    expect(checkbox).toBeDisabled();

    // The only textbox in the drawer is the editable, auto-populated branch.
    const branchInput = screen.getByRole('textbox');
    expect(branchInput).not.toHaveAttribute('readonly');
    expect((branchInput as HTMLInputElement).value).toMatch(/^migrate-pr-only\//);
  });

  it('lets a write-capable repo opt into pushing to a branch via the checkbox', async () => {
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
        selective={false}
        repos={[makeRepo('repo-1', 'My repo', ['write', 'branch'])]}
        onDismiss={jest.fn()}
      />
    );

    // Unchecked by default → direct write, so no branch field is shown.
    const checkbox = await screen.findByRole('checkbox', { name: /push changes to a branch/i });
    expect(checkbox).not.toBeChecked();
    expect(checkbox).toBeEnabled();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();

    // Checking it auto-populates the editable branch field.
    await user.click(checkbox);
    const branchInput = screen.getByRole('textbox');
    expect(branchInput).not.toHaveAttribute('readonly');
    expect((branchInput as HTMLInputElement).value).toMatch(/^migrate-repo-1\//);

    await user.click(screen.getByRole('button', { name: /migrate everything/i }));

    expect(await screen.findByText('Pulling...')).toBeInTheDocument();
    expect(postedBody).toMatch(/"branch":"migrate-repo-1\//);
  });

  it('submits a user-edited target branch', async () => {
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
        selective={false}
        repos={[makeRepo('pr-only', 'PR only repo', ['branch'])]}
        onDismiss={jest.fn()}
      />
    );

    const branchInput = await screen.findByRole('textbox');
    await user.clear(branchInput);
    await user.type(branchInput, 'my-custom-branch');

    await user.click(screen.getByRole('button', { name: /migrate everything/i }));

    expect(await screen.findByText('Pulling...')).toBeInTheDocument();
    expect(postedBody).toMatch(/"branch":"my-custom-branch"/);
  });

  it('blocks migration when the edited branch name is invalid', async () => {
    const { user } = render(
      <MigrateDrawer
        selective={false}
        repos={[makeRepo('pr-only', 'PR only repo', ['branch'])]}
        onDismiss={jest.fn()}
      />
    );

    const branchInput = await screen.findByRole('textbox');
    await user.clear(branchInput);
    await user.type(branchInput, 'bad branch..name');

    expect(screen.getByText(/invalid branch name/i)).toBeInTheDocument();
    // A disabled button that keeps a tooltip renders with aria-disabled rather
    // than the native disabled attribute.
    const migrateButton = screen.getByRole('button', { name: /migrate everything/i });
    expect(migrateButton).toHaveAttribute('aria-disabled', 'true');
    // Hovering surfaces a tooltip explaining why the button is disabled.
    await user.hover(migrateButton);
    expect(await screen.findByText('Enter a valid target branch name')).toBeInTheDocument();
  });

  it('offers both write and branch-workflow repositories as migration targets', async () => {
    // A write repo (direct commit) and a branch repo (pull request) are both
    // usable, so neither is flagged as blocked. Two usable repos means none is
    // pre-selected, so migration stays disabled until the user chooses.
    render(
      <MigrateDrawer
        selective={false}
        repos={[makeRepo('push', 'Pushable repo'), makeRepo('pr', 'PR only repo', ['branch'])]}
        onDismiss={jest.fn()}
      />
    );

    expect(await screen.findByText('Target repository')).toBeInTheDocument();
    expect(screen.queryByText(/read-only repositories are disabled/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /migrate everything/i })).toHaveAttribute('aria-disabled', 'true');
  });

  it('treats a repository with no writable workflow as blocked without crashing', async () => {
    // `spec` is optional on the API type; a repo missing it (hence no workflows)
    // is read-only and should be handled gracefully — disabled and never
    // pre-selected — alongside a usable one.
    render(
      <MigrateDrawer
        selective={false}
        repos={[makeRepo('ok', 'Usable repo'), { metadata: { name: 'no-spec' } } as Repository]}
        onDismiss={jest.fn()}
      />
    );

    // The usable repo is pre-selected; the spec-less one counts as blocked.
    expect(await screen.findByText('Usable repo')).toBeInTheDocument();
    expect(screen.getByText(/read-only repositories are disabled/i)).toBeInTheDocument();
  });

  it('enables migration once a repository is picked from the dropdown', async () => {
    // Two usable repos means none is pre-selected, so the user must choose one.
    const { user } = render(
      <MigrateDrawer
        selective={false}
        repos={[makeRepo('a', 'Repo A'), makeRepo('b', 'Repo B')]}
        onDismiss={jest.fn()}
      />
    );

    expect(await screen.findByRole('button', { name: /migrate everything/i })).toHaveAttribute('aria-disabled', 'true');

    await user.click(screen.getByRole('combobox'));
    await user.click(await screen.findByText('Repo B'));

    expect(await screen.findByRole('button', { name: /migrate everything/i })).toBeEnabled();
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

  it('forwards the auto-generated target branch on the migrate job for a branch-only repo', async () => {
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
        selective={false}
        repos={[makeRepo('pr-only', 'PR only repo', ['branch'])]}
        onDismiss={jest.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: /migrate everything/i }));

    expect(await screen.findByText('Pulling...')).toBeInTheDocument();
    // The generated branch is forwarded, prefixed with `migrate-<repo>`.
    expect(postedBody).toMatch(/"branch":"migrate-pr-only\//);
  });

  it('omits the branch when migrating directly into the configured branch', async () => {
    // A write repo with no branch entered writes directly to the configured
    // branch, so the migrate options must not carry a `branch` field.
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
    expect(postedBody).toContain('"action":"migrate"');
    expect(postedBody).not.toContain('"branch"');
  });

  it('does not regenerate folder UIDs when migrating into an instance-sync repository', async () => {
    // Instance sync takes over the whole instance, so it must preserve the
    // existing folder UIDs instead of recreating folders.
    let postedBody = '';
    server.use(
      http.post(`${BASE}/repositories/:name/jobs`, async ({ request }) => {
        postedBody = await request.text();
        return HttpResponse.json(createJob());
      })
    );
    mockJobList(createJob());

    const instanceRepo = createRepository({
      metadata: { name: 'inst' },
      spec: { title: 'Instance repo', workflows: ['write'], sync: { target: 'instance', enabled: true } },
    });
    const { user } = render(<MigrateDrawer selective={false} repos={[instanceRepo]} onDismiss={jest.fn()} />);
    await user.click(screen.getByRole('button', { name: /migrate everything/i }));

    expect(await screen.findByText('Pulling...')).toBeInTheDocument();
    expect(postedBody).toContain('"action":"migrate"');
    expect(postedBody).toContain('"generateNewFolderIDs":false');
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

  it('shows an "Open pull request" link when a branch migration completes', async () => {
    // A branch migration finishes with the backend-populated pull-request URL on
    // the job status; the drawer surfaces it so the user can open the PR.
    mockCreateJob(createJob());
    mockJobList(createJob());
    mockRepositoryLookup();

    const { user } = render(
      <MigrateDrawer
        selective={false}
        repos={[makeRepo('pr-only', 'PR only repo', ['branch'])]}
        onDismiss={jest.fn()}
      />
    );
    await user.click(await screen.findByRole('button', { name: /migrate everything/i }));

    expect(await screen.findByText('Pulling...')).toBeInTheDocument();

    act(() => {
      getMockLiveSrv().emitWatchEvent('jobs', {
        type: 'MODIFIED',
        object: createJob({
          status: {
            state: 'success',
            url: { newPullRequestURL: 'https://github.com/org/repo/compare/main...migrate-pr-only' },
          },
        }),
      });
    });

    expect(await screen.findByRole('link', { name: /open pull request/i })).toHaveAttribute(
      'href',
      'https://github.com/org/repo/compare/main...migrate-pr-only'
    );
    // Migrate shows only the pull-request link, not the branch/compare links.
    expect(screen.queryByRole('link', { name: /view branch/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /compare branch/i })).not.toBeInTheDocument();
  });

  it('surfaces the error message when the migration job fails', async () => {
    mockCreateJob(createJob());
    mockJobList(createJob());

    const { user } = render(
      <MigrateDrawer selective={false} repos={[makeRepo('repo-1', 'My only repo')]} onDismiss={jest.fn()} />
    );
    await user.click(screen.getByRole('button', { name: /migrate everything/i }));

    expect(await screen.findByText('Pulling...')).toBeInTheDocument();

    act(() => {
      getMockLiveSrv().emitWatchEvent('jobs', {
        type: 'MODIFIED',
        object: createJob({
          status: { state: 'error', message: 'export would exceed quota: 1371/1000 resources' },
        }),
      });
    });

    // The failure reason must be visible directly, not hidden behind "View details".
    expect(await screen.findByText(/export would exceed quota: 1371\/1000 resources/i)).toBeInTheDocument();
    // Retry is rendered via Alert's buttonContent/onRemove, not as a standard named button.
    expect((await screen.findByText('Retry')).closest('button')).not.toBeNull();
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

    it('falls back to the resource count for the summary when no selection is provided', async () => {
      // Without an explicit `selection`, the summary derives the count from
      // `resources` instead.
      render(
        <MigrateDrawer
          selective
          repos={[makeRepo('repo-1', 'My only repo')]}
          resources={resources}
          onDismiss={jest.fn()}
        />
      );

      expect(await screen.findByText(/2 selected resources/i)).toBeInTheDocument();
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
