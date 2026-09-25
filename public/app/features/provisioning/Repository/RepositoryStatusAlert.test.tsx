import { HttpResponse, http } from 'msw';
import { act, render, screen } from 'test/test-utils';

import { PROVISIONING_API_BASE as BASE } from '@grafana/test-utils/handlers';
import server from '@grafana/test-utils/server';
import { type Repository } from 'app/api/clients/provisioning/v0alpha1';
import { appEvents } from 'app/core/app_events';
import { ShowConfirmModalEvent } from 'app/types/events';

import { setupProvisioningMswServer } from '../mocks/server';

import { RepositoryStatusAlert } from './RepositoryStatusAlert';

setupProvisioningMswServer();

const repository = {
  metadata: {
    name: 'test-repo',
    finalizers: ['remove-orphan-resources', 'remove-pending-jobs', 'cleanup'],
  },
  spec: {
    title: 'Test repository',
    type: 'github',
    sync: { target: 'folder', enabled: true },
    workflows: [],
  },
  status: {
    health: { healthy: true },
    sync: { state: 'success', message: [] },
    observedGeneration: 1,
    webhook: {},
  },
} as Repository;

describe('RepositoryStatusAlert', () => {
  it('does not render for a healthy repository', () => {
    const { container } = render(<RepositoryStatusAlert repository={repository} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('shows field error details without a force-delete button', () => {
    const detail = 'The repository returned 404 Not Found';
    render(
      <RepositoryStatusAlert
        repository={{
          ...repository,
          status: {
            ...repository.status!,
            health: { healthy: false, error: 'health', message: [detail] },
            fieldErrors: [{ type: 'FieldValueInvalid', field: 'secure.token', detail }],
          },
        }}
      />
    );

    expect(screen.getByText('Repository error')).toBeInTheDocument();
    expect(screen.getByText(detail)).toBeInTheDocument();
    // A field/validation error is not a wedged deletion, so no escape hatch.
    expect(screen.queryByRole('button', { name: /delete anyway/i })).not.toBeInTheDocument();
  });

  it('shows the deletion error and a force-delete button for a blocked deletion', () => {
    const message = 'The cleanup step could not remove the provider webhook.';
    render(
      <RepositoryStatusAlert
        repository={{
          ...repository,
          metadata: { ...repository.metadata, deletionTimestamp: '2026-09-11T00:00:00Z' },
          status: { ...repository.status!, deletion: { state: 'Blocked', finalizer: 'cleanup', message } },
        }}
      />
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Repository deletion error')).toBeInTheDocument();
    expect(screen.getByText(message)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /delete anyway/i })).toBeInTheDocument();
  });

  it('force-removes exactly the blocking finalizer the backend named', async () => {
    let replaceFinalizers: string[] | undefined;
    server.use(
      http.put(`${BASE}/repositories/:name`, async ({ request }) => {
        const body = (await request.json()) as Repository;
        replaceFinalizers = body.metadata?.finalizers;
        return HttpResponse.json(body);
      })
    );

    const publishSpy = jest.spyOn(appEvents, 'publish');
    const { user } = render(
      <RepositoryStatusAlert
        repository={{
          ...repository,
          metadata: { ...repository.metadata, deletionTimestamp: '2026-09-11T00:00:00Z' },
          status: {
            ...repository.status!,
            deletion: { state: 'Blocked', finalizer: 'cleanup', message: 'blocked' },
          },
        }}
      />
    );

    await user.click(screen.getByRole('button', { name: /delete anyway/i }));

    expect(publishSpy).toHaveBeenCalledWith(expect.any(ShowConfirmModalEvent));
    const event = publishSpy.mock.calls.at(-1)![0] as ShowConfirmModalEvent;

    await act(async () => {
      await event.payload.onConfirm?.();
    });

    // Only the named finalizer is dropped; the rest stay so the in-progress
    // deletion still releases/removes resources.
    expect(replaceFinalizers).toEqual(['remove-orphan-resources', 'remove-pending-jobs']);
  });

  it('offers to release resources instead when removing managed resources is blocked', async () => {
    let jobAction: string | undefined;
    server.use(
      http.post(`${BASE}/repositories/:name/jobs`, async ({ request }) => {
        const body = (await request.json()) as { action?: string };
        jobAction = body.action;
        return HttpResponse.json({ metadata: { name: 'job-1' }, spec: body }, { status: 202 });
      })
    );

    const publishSpy = jest.spyOn(appEvents, 'publish');
    const { user } = render(
      <RepositoryStatusAlert
        repository={{
          ...repository,
          metadata: { ...repository.metadata, deletionTimestamp: '2026-09-11T00:00:00Z' },
          status: {
            ...repository.status!,
            deletion: { state: 'Blocked', finalizer: 'remove-orphan-resources', message: 'folder not empty' },
          },
        }}
      />
    );

    // Force-removing this finalizer would leave folders annotated as managed by a
    // deleted repository, so releasing is offered instead.
    expect(screen.queryByRole('button', { name: /delete anyway/i })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /release all resources/i }));

    const event = publishSpy.mock.calls.at(-1)![0] as ShowConfirmModalEvent;
    await act(async () => {
      await event.payload.onConfirm?.();
    });

    expect(jobAction).toBe('releaseResources');
    expect(screen.getByText(/releasing resources/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /release all resources/i })).not.toBeInTheDocument();
  });
});
