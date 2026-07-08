import { HttpResponse, http } from 'msw';
import { render, screen } from 'test/test-utils';

import { PROVISIONING_API_BASE as BASE } from '@grafana/test-utils/handlers';
import server from '@grafana/test-utils/server';
import { type Job } from 'app/api/clients/provisioning/v0alpha1';

import { createJob, createRepository } from '../mocks/factories';
import { setupProvisioningMswServer } from '../mocks/server';

import { RecentJobs } from './RecentJobs';

setupProvisioningMswServer();

function mockJobs(jobs: Job[]) {
  server.use(
    http.get(`${BASE}/jobs`, () => HttpResponse.json({ items: jobs, metadata: { resourceVersion: '1' } })),
    http.get(`${BASE}/repositories/:name/jobs`, () =>
      HttpResponse.json({ items: [], metadata: { resourceVersion: '1' } })
    )
  );
}

function setup(jobs: Job[]) {
  mockJobs(jobs);
  return render(<RecentJobs repo={createRepository()} />);
}

describe('RecentJobs', () => {
  it('shows the triggering user', async () => {
    setup([
      createJob({
        metadata: {
          name: 'job-1',
          uid: 'uid-1',
          annotations: { 'provisioning.grafana.app/triggeredBy': 'Ada Lovelace' },
        },
      }),
    ]);

    expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument();
  });

  it('shows Webhook when no user triggered the job', async () => {
    setup([createJob()]);

    expect(await screen.findByText('Webhook')).toBeInTheDocument();
  });
});
