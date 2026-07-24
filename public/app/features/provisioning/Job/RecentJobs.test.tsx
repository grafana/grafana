import { HttpResponse, http } from 'msw';
import { act, render, screen } from 'test/test-utils';

import { PROVISIONING_API_BASE as BASE } from '@grafana/test-utils/handlers';
import server from '@grafana/test-utils/server';
import { setTestFlags } from '@grafana/test-utils/unstable';
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
  afterEach(async () => {
    await act(async () => {
      setTestFlags({});
    });
  });

  describe('with the userAttribution flag enabled', () => {
    beforeEach(() => {
      setTestFlags({ 'provisioning.userAttribution': true });
    });

    it('shows the triggering user with the recorded origin', async () => {
      setup([
        createJob({
          metadata: {
            name: 'job-1',
            uid: 'uid-1',
            annotations: {
              'provisioning.grafana.app/author': 'Ada Lovelace',
              'provisioning.grafana.app/authorOrigin': 'UI',
            },
          },
        }),
      ]);

      expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument();
      expect(screen.getByText('UI')).toBeInTheDocument();
    });

    it('falls back to the author email when the name is missing', async () => {
      setup([
        createJob({
          metadata: {
            name: 'job-1',
            uid: 'uid-1',
            annotations: { 'provisioning.grafana.app/authorEmail': 'ada@example.com' },
          },
        }),
      ]);

      expect(await screen.findByText('ada@example.com')).toBeInTheDocument();
    });

    it('shows Unknown as the origin when the job has no attribution', async () => {
      setup([createJob()]);

      expect(await screen.findByText('job-1')).toBeInTheDocument();
      expect(screen.getByText('Unknown')).toBeInTheDocument();
    });

    it('shows the webhook sender with the provider as the origin', async () => {
      setup([
        createJob({
          metadata: {
            name: 'job-1',
            uid: 'uid-1',
            annotations: {
              'provisioning.grafana.app/author': 'amalavet',
              'provisioning.grafana.app/authorOrigin': 'github',
            },
          },
        }),
      ]);

      expect(await screen.findByText('amalavet')).toBeInTheDocument();
      expect(screen.getByText('GitHub')).toBeInTheDocument();
    });

    it('shows webhook attribution in the expanded job specification', async () => {
      const { user } = setup([
        createJob({
          metadata: {
            name: 'job-1',
            uid: 'uid-1',
            annotations: {
              'provisioning.grafana.app/author': 'amalavet',
              'provisioning.grafana.app/authorId': '12345',
              'provisioning.grafana.app/authorOrigin': 'github',
            },
          },
        }),
      ]);

      await user.click(await screen.findByRole('button', { name: /toggle row expanded/i }));

      expect(await screen.findByText('author')).toBeInTheDocument();
      expect(screen.getAllByText(/amalavet/)).toHaveLength(2);
      expect(screen.getByText('authorId')).toBeInTheDocument();
      expect(screen.getByText(/12345/)).toBeInTheDocument();
      expect(screen.getByText('authorOrigin')).toBeInTheDocument();
    });

    it('shows user attribution in the expanded job specification', async () => {
      const { user } = setup([
        createJob({
          metadata: {
            name: 'job-1',
            uid: 'uid-1',
            annotations: {
              'provisioning.grafana.app/author': 'Ada Lovelace',
              'provisioning.grafana.app/authorEmail': 'ada@example.com',
            },
          },
        }),
      ]);

      await user.click(await screen.findByRole('button', { name: /toggle row expanded/i }));

      expect(await screen.findByText('author')).toBeInTheDocument();
      expect(screen.getByText('authorEmail')).toBeInTheDocument();
      expect(screen.getByText(/ada@example\.com/)).toBeInTheDocument();
    });
  });

  describe('with the userAttribution flag disabled', () => {
    beforeEach(() => {
      setTestFlags({ 'provisioning.userAttribution': false });
    });

    it('hides the author column', async () => {
      setup([
        createJob({
          metadata: {
            name: 'job-1',
            uid: 'uid-1',
            annotations: { 'provisioning.grafana.app/author': 'Ada Lovelace' },
          },
        }),
      ]);

      expect(await screen.findByText('job-1')).toBeInTheDocument();
      expect(screen.queryByText('Author')).not.toBeInTheDocument();
      expect(screen.queryByText('Ada Lovelace')).not.toBeInTheDocument();
    });
  });
});
