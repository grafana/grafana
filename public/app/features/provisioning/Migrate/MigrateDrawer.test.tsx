import { HttpResponse, http } from 'msw';
import { act, render, screen, waitFor } from 'test/test-utils';

import { PROVISIONING_API_BASE as BASE } from '@grafana/test-utils/handlers';
import server from '@grafana/test-utils/server';
import { type Repository } from 'app/api/clients/provisioning/v0alpha1';

import { createJob, createRepository } from '../mocks/factories';
import { getMockLiveSrv, setupProvisioningMswServer } from '../mocks/server';

import { MigrateDrawer } from './MigrateDrawer';

setupProvisioningMswServer();

function makeRepo(name: string, title: string): Repository {
  return createRepository({ metadata: { name }, spec: { title } });
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
    render(<MigrateDrawer repos={[makeRepo('repo-1', 'My only repo')]} onDismiss={jest.fn()} />);

    expect(await screen.findByRole('combobox')).toHaveValue('My only repo');
  });

  it('keeps the migrate button disabled until a repository is selected', async () => {
    render(<MigrateDrawer repos={[makeRepo('a', 'Repo A'), makeRepo('b', 'Repo B')]} onDismiss={jest.fn()} />);

    // The button keeps a tooltip while disabled, so Grafana renders it with
    // aria-disabled rather than the native disabled attribute.
    expect(await screen.findByRole('button', { name: /migrate everything/i })).toHaveAttribute('aria-disabled', 'true');
  });

  it('calls onDismiss when cancelled', async () => {
    const onDismiss = jest.fn();
    const { user } = render(<MigrateDrawer repos={[makeRepo('repo-1', 'My only repo')]} onDismiss={onDismiss} />);

    await user.click(await screen.findByRole('button', { name: /cancel/i }));

    expect(onDismiss).toHaveBeenCalled();
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

    const { user } = render(<MigrateDrawer repos={[makeRepo('repo-1', 'My only repo')]} onDismiss={jest.fn()} />);
    await user.click(screen.getByRole('button', { name: /migrate everything/i }));

    expect(await screen.findByText('Pulling...')).toBeInTheDocument();
    // It must be a migrate job (not a plain pull).
    expect(postedBody).toContain('"action":"migrate"');
    // The selection form is replaced by the job view.
    expect(screen.queryByText(/target repository/i)).not.toBeInTheDocument();
  });

  it('notifies onMigrated once the migration completes', async () => {
    const onMigrated = jest.fn();
    mockCreateJob(createJob());
    mockJobList(createJob());
    mockRepositoryLookup();

    const { user } = render(
      <MigrateDrawer repos={[makeRepo('repo-1', 'My only repo')]} onDismiss={jest.fn()} onMigrated={onMigrated} />
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
});
