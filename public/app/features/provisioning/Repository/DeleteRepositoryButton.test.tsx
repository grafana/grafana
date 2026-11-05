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

const createMockRepository = (): Repository => ({
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
    health: { healthy: true, checked: 1 },
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
  it('deletes a repository without editing its finalizers', async () => {
    const event = await openMenuAndConfirm(createMockRepository(), /remove resources/i);

    await confirmDelete(event);

    await waitFor(() => expect(captured.deletedName).toBe('test-repo'));
    // remove-resources needs no metadata edit, so no replace request.
    expect(captured.replaceFinalizers).toBeUndefined();
    expect(reportInteraction).toHaveBeenCalledWith(
      'grafana_provisioning_repository_deleted',
      expect.objectContaining({ deleteAction: 'remove-resources', forceDelete: false })
    );
  });

  it('swaps to the release-orphan finalizer for a keep-resources delete', async () => {
    const event = await openMenuAndConfirm(createMockRepository(), /keep resources/i);

    await confirmDelete(event);

    await waitFor(() => expect(captured.deletedName).toBe('test-repo'));
    // keep-resources keeps cleanup (webhook still removed) but releases resources.
    expect(captured.replaceFinalizers).toEqual(['cleanup', 'release-orphan-resources']);
    expect(reportInteraction).toHaveBeenCalledWith(
      'grafana_provisioning_repository_deleted',
      expect.objectContaining({ deleteAction: 'keep-resources', forceDelete: false })
    );
  });

  it('does not delete when the keep-resources finalizer update fails', async () => {
    let replaceAttempted = false;
    server.use(
      http.put(`${BASE}/repositories/:name`, () => {
        replaceAttempted = true;
        return new HttpResponse(null, { status: 500 });
      })
    );

    // keep-resources issues the finalizer PUT first. If that PUT fails we must
    // abort rather than delete with the wrong finalizer set.
    const event = await openMenuAndConfirm(createMockRepository(), /keep resources/i);
    await confirmDelete(event);

    await waitFor(() => expect(replaceAttempted).toBe(true));
    expect(captured.deletedName).toBeUndefined();
  });
});
