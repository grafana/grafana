import { render, screen, waitFor } from 'test/test-utils';

import { reportInteraction } from '@grafana/runtime';
import {
  type Repository,
  useDeleteRepositoryMutation,
  useReplaceRepositoryMutation,
} from 'app/api/clients/provisioning/v0alpha1';
import { appEvents } from 'app/core/app_events';
import { ShowConfirmModalEvent } from 'app/types/events';

import { DeleteRepositoryButton } from './DeleteRepositoryButton';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: jest.fn(),
}));

jest.mock('app/api/clients/provisioning/v0alpha1', () => ({
  ...jest.requireActual('app/api/clients/provisioning/v0alpha1'),
  useDeleteRepositoryMutation: jest.fn(),
  useReplaceRepositoryMutation: jest.fn(),
}));

const mockDelete = jest.fn();
const mockReplace = jest.fn();

const createMockRepository = (healthy: boolean): Repository => ({
  metadata: {
    name: 'test-repo',
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
    health: { healthy, checked: 0 },
    sync: { state: 'success', message: [] },
    observedGeneration: 1,
    webhook: {},
  },
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

beforeEach(() => {
  jest.clearAllMocks();
  mockDelete.mockResolvedValue({});
  mockReplace.mockResolvedValue({});
  jest.mocked(useDeleteRepositoryMutation).mockReturnValue([
    mockDelete,
    { isLoading: false, reset: jest.fn() },
  ] as unknown as ReturnType<typeof useDeleteRepositoryMutation>);
  jest.mocked(useReplaceRepositoryMutation).mockReturnValue([
    mockReplace,
    { isLoading: false, reset: jest.fn() },
  ] as unknown as ReturnType<typeof useReplaceRepositoryMutation>);
});

describe('DeleteRepositoryButton', () => {
  it('deletes a healthy repository without editing its finalizers', async () => {
    const event = await openMenuAndConfirm(createMockRepository(true), /remove resources/i);

    expect(event.payload.text).not.toMatch(/unhealthy/i);

    event.payload.onConfirm?.();

    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith({ name: 'test-repo' }));
    // Healthy + remove-resources needs no metadata edit, so no replace call.
    expect(mockReplace).not.toHaveBeenCalled();
    expect(reportInteraction).toHaveBeenCalledWith(
      'grafana_provisioning_repository_deleted',
      expect.objectContaining({ deleteAction: 'remove-resources', forceDelete: false })
    );
  });

  it('warns and drops the cleanup finalizer when deleting an unhealthy repository', async () => {
    const event = await openMenuAndConfirm(createMockRepository(false), /remove resources/i);

    expect(event.payload.text).toMatch(/unhealthy/i);

    event.payload.onConfirm?.();

    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith({
        name: 'test-repo',
        repository: expect.objectContaining({
          metadata: expect.objectContaining({
            finalizers: ['remove-orphan-resources', 'remove-pending-jobs'],
          }),
        }),
      })
    );
    expect(mockDelete).toHaveBeenCalledWith({ name: 'test-repo' });
    expect(reportInteraction).toHaveBeenCalledWith(
      'grafana_provisioning_repository_deleted',
      expect.objectContaining({ deleteAction: 'remove-resources', forceDelete: true })
    );
  });

  it('drops the cleanup finalizer from the keep-resources set for an unhealthy keep-resources delete', async () => {
    const event = await openMenuAndConfirm(createMockRepository(false), /keep resources/i);

    event.payload.onConfirm?.();

    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith({
        name: 'test-repo',
        repository: expect.objectContaining({
          metadata: expect.objectContaining({
            finalizers: ['release-orphan-resources'],
          }),
        }),
      })
    );
    expect(mockDelete).toHaveBeenCalledWith({ name: 'test-repo' });
  });

  it('keeps the cleanup finalizer for a healthy keep-resources delete', async () => {
    const event = await openMenuAndConfirm(createMockRepository(true), /keep resources/i);

    event.payload.onConfirm?.();

    await waitFor(() => expect(mockReplace).toHaveBeenCalledTimes(1));
    const replaceArg = mockReplace.mock.calls[0][0];
    expect(replaceArg.repository.metadata.finalizers).toEqual(['cleanup', 'release-orphan-resources']);
  });
});
