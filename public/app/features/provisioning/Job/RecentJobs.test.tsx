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

    it('shows the triggering user with Grafana as the origin', async () => {
      setup([
        createJob({
          metadata: {
            name: 'job-1',
            uid: 'uid-1',
            annotations: { 'provisioning.grafana.app/author': 'Ada Lovelace' },
          },
        }),
      ]);

      expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument();
      expect(screen.getByText('Grafana')).toBeInTheDocument();
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

    it('leaves the triggered by cell empty when no user triggered the job', async () => {
      setup([createJob()]);

      expect(await screen.findByText('job-1')).toBeInTheDocument();
      expect(screen.queryByText('System')).not.toBeInTheDocument();
      expect(screen.getByText('Grafana')).toBeInTheDocument();
    });

    it('shows the webhook sender with the provider as the origin', async () => {
      setup([
        createJob({
          metadata: {
            name: 'job-1',
            uid: 'uid-1',
            annotations: { 'provisioning.grafana.app/webhookSender': 'amalavet' },
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
              'provisioning.grafana.app/webhookSender': 'amalavet',
              'provisioning.grafana.app/webhookSenderId': '12345',
            },
          },
        }),
      ]);

      await user.click(await screen.findByRole('button', { name: /toggle row expanded/i }));

      expect(await screen.findByText('triggeredBy')).toBeInTheDocument();
      expect(screen.getByText(/amalavet \(via Webhook\) GitHub ID:12345/)).toBeInTheDocument();
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
              'grafana.app/createdBy': 'user:abc123',
            },
          },
        }),
      ]);

      await user.click(await screen.findByRole('button', { name: /toggle row expanded/i }));

      expect(await screen.findByText('triggeredBy')).toBeInTheDocument();
      expect(screen.getByText(/Ada Lovelace, ada@example\.com, user:abc123/)).toBeInTheDocument();
    });
  });

  describe('with the userAttribution flag disabled', () => {
    beforeEach(() => {
      setTestFlags({ 'provisioning.userAttribution': false });
    });

    it('hides the triggered by column', async () => {
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
      expect(screen.queryByText('Triggered by')).not.toBeInTheDocument();
      expect(screen.queryByText('Ada Lovelace')).not.toBeInTheDocument();
    });
  });
});
