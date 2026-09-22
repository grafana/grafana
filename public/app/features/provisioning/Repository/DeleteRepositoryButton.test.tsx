import { HttpResponse, http } from 'msw';
import { act, render, screen, waitFor } from 'test/test-utils';

import { reportInteraction } from '@grafana/runtime';
import { PROVISIONING_API_BASE as BASE } from '@grafana/test-utils/handlers';
import server from '@grafana/test-utils/server';
import { type Repository } from 'app/api/clients/provisioning/v0alpha1';
import { appEvents } from 'app/core/app_events';
import { ShowConfirmModalEvent } from 'app/types/events';

import { setupProvisioningMswServer } from '../mocks/server';

import { DeleteRepositoryButton } from './DeleteRepositoryButton';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: jest.fn(),
}));

setupProvisioningMswServer();

// Builds a repository whose Ready condition reflects reachability. An
// unreachable repo (bad creds) reports Ready=False with reason
// AuthenticationFailed, which is what drives the force-delete path; a healthy
// repo reports Ready=True. Pass a readyReason to model unhealthy-but-reachable
// states (e.g. QuotaExceeded).
const createMockRepository = (healthy: boolean, readyReason?: string): Repository => ({
  metadata: {
    name: 'test-repo',
    generation: 1,
    // The default finalizer set the backend seeds on a repository.
    finalizers: ['remove-orphan-resources', 'remove-pending-jobs', 'cleanup'],
  },
  spec: {
    title: 'Test Repository',
    type: 'github',
    sync: { target: 'folder', enabled: true },
    workflows: [],
    github: { url: 'https://github.com/owner/repo', branch: 'main' },
  },
  status: {
    health: { healthy, checked: 1 },
    conditions: [
      {
        type: 'Ready',
        status: healthy ? 'True' : 'False',
        reason: healthy ? 'Available' : (readyReason ?? 'AuthenticationFailed'),
        message: healthy ? '' : 'the repository is unhealthy',
        lastTransitionTime: '2024-01-01T00:00:00Z',
        observedGeneration: 1,
      },
    ],
    sync: { state: 'success', message: [] },
    observedGeneration: 1,
    webhook: {},
  },
});

// Records the delete/replace requests the component makes so tests can assert
// the finalizer set that was PUT and that the repository was actually deleted.
// The component always awaits the (optional) replace before the delete, so once
// a delete is observed any replace that was going to happen already has.
let captured: { replaceFinalizers?: string[]; deletedName?: string };

beforeEach(() => {
  jest.clearAllMocks();
  captured = {};
  server.use(
    http.put(`${BASE}/repositories/:name`, async ({ request }) => {
      const body = (await request.json()) as Repository;
      captured.replaceFinalizers = body.metadata?.finalizers;
      return HttpResponse.json(body);
    }),
    http.delete(`${BASE}/repositories/:name`, ({ params }) => {
      captured.deletedName = params.name as string;
      return HttpResponse.json({});
    })
  );
});

// Opens the dropdown and clicks the named menu item, returning the confirm
// event that was published so the caller can inspect its text and fire onConfirm.
async function openMenuAndConfirm(repository: Repository, menuItem: RegExp) {
  const publishSpy = jest.spyOn(appEvents, 'publish');
  const { user } = render(<DeleteRepositoryButton name="test-repo" repository={repository} />);

  await user.click(screen.getByRole('button', { name: /delete/i }));
  await user.click(screen.getByRole('menuitem', { name: menuItem }));

  expect(publishSpy).toHaveBeenCalledWith(expect.any(ShowConfirmModalEvent));
  return publishSpy.mock.calls[0][0] as ShowConfirmModalEvent;
}

// Fires the modal's confirm handler, which triggers the real delete/replace
// mutations. Wrapped in act because those resolve asynchronously and flip the
// component's loading state.
async function confirmDelete(event: ShowConfirmModalEvent) {
  await act(async () => {
    await event.payload.onConfirm?.();
  });
}

describe('DeleteRepositoryButton', () => {
  it('deletes a healthy repository without editing its finalizers', async () => {
    const event = await openMenuAndConfirm(createMockRepository(true), /remove resources/i);

    expect(event.payload.text).not.toMatch(/unhealthy/i);

    await confirmDelete(event);

    await waitFor(() => expect(captured.deletedName).toBe('test-repo'));
    // Healthy + remove-resources needs no metadata edit, so no replace request.
    expect(captured.replaceFinalizers).toBeUndefined();
    expect(reportInteraction).toHaveBeenCalledWith(
      'grafana_provisioning_repository_deleted',
      expect.objectContaining({ deleteAction: 'remove-resources', forceDelete: false })
    );
  });

  it('warns and drops the cleanup finalizer when deleting an unhealthy repository', async () => {
    const event = await openMenuAndConfirm(createMockRepository(false), /remove resources/i);

    // The warning must spell out the actual consequence: provider-side
    // resources (webhooks) can't be removed and are left behind.
    expect(event.payload.text).toMatch(/unhealthy/i);
    expect(event.payload.text).toMatch(/webhooks/i);
    expect(event.payload.text).toMatch(/left in place/i);

    await confirmDelete(event);

    await waitFor(() => expect(captured.deletedName).toBe('test-repo'));
    expect(captured.replaceFinalizers).toEqual(['remove-orphan-resources', 'remove-pending-jobs']);
    expect(reportInteraction).toHaveBeenCalledWith(
      'grafana_provisioning_repository_deleted',
      expect.objectContaining({ deleteAction: 'remove-resources', forceDelete: true })
    );
  });

  it('drops the cleanup finalizer from the keep-resources set for an unhealthy keep-resources delete', async () => {
    const event = await openMenuAndConfirm(createMockRepository(false), /keep resources/i);

    await confirmDelete(event);

    await waitFor(() => expect(captured.deletedName).toBe('test-repo'));
    expect(captured.replaceFinalizers).toEqual(['release-orphan-resources']);
  });

  it('keeps the cleanup finalizer for a healthy keep-resources delete', async () => {
    const event = await openMenuAndConfirm(createMockRepository(true), /keep resources/i);

    await confirmDelete(event);

    await waitFor(() => expect(captured.deletedName).toBe('test-repo'));
    expect(captured.replaceFinalizers).toEqual(['cleanup', 'release-orphan-resources']);
  });

  // These are unhealthy (Ready=False) but must NOT force-delete: the backend can
  // still clean up the webhook (invalid spec / over quota are reachable; the
  // delete path never runs Test()) or the failure is transient and will
  // self-heal (ServiceUnavailable), so dropping the cleanup finalizer would
  // orphan the webhook needlessly.
  it.each(['QuotaExceeded', 'InvalidSpec', 'ServiceUnavailable'])(
    'does not force-delete an unhealthy repository whose Ready reason is %s',
    async (reason) => {
      const event = await openMenuAndConfirm(createMockRepository(false, reason), /remove resources/i);

      expect(event.payload.text).not.toMatch(/unhealthy/i);

      await confirmDelete(event);

      await waitFor(() => expect(captured.deletedName).toBe('test-repo'));
      // Cleanup is still viable, so no finalizer edit, no replace request, no force.
      expect(captured.replaceFinalizers).toBeUndefined();
      expect(reportInteraction).toHaveBeenCalledWith(
        'grafana_provisioning_repository_deleted',
        expect.objectContaining({ deleteAction: 'remove-resources', forceDelete: false })
      );
    }
  );
});
