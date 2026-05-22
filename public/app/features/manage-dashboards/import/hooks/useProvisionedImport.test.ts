import { renderHook, waitFor } from '@testing-library/react';
import { HttpResponse, delay, http } from 'msw';
import { getWrapper } from 'test/test-utils';

import { config } from '@grafana/runtime';
import { PROVISIONING_API_BASE as BASE } from '@grafana/test-utils/handlers';
import server from '@grafana/test-utils/server';
import { type RepositoryView } from 'app/api/clients/provisioning/v0alpha1';
import { AnnoKeyManagerIdentity, AnnoKeyManagerKind, ManagerKind } from 'app/features/apiserver/types';
import { setupProvisioningMswServer } from 'app/features/provisioning/mocks/server';

import { useImportProvisionedSave } from './useImportProvisionedSave';
import { useProvisionedImport, type UseProvisionedImportArgs } from './useProvisionedImport';

// --- Mocks ---

jest.mock('./useImportProvisionedSave', () => ({
  useImportProvisionedSave: jest.fn(),
}));

setupProvisioningMswServer();

// --- Helpers ---

const FOLDER_BASE = '/apis/folder.grafana.app/v1beta1/namespaces/:namespace';

const mockRepository: RepositoryView = {
  name: 'test-repo',
  branch: 'main',
  type: 'github',
  target: 'folder',
  title: 'Test Repo',
  workflows: ['write', 'branch'],
};

const mockSave = jest.fn();
const mockUseImportProvisionedSave = jest.mocked(useImportProvisionedSave);

function makeFolderResponse(uid: string, repoName?: string) {
  return {
    kind: 'Folder',
    apiVersion: 'folder.grafana.app/v1beta1',
    metadata: {
      name: uid,
      namespace: 'default',
      uid,
      creationTimestamp: '2023-01-01T00:00:00Z',
      annotations: {
        'grafana.app/createdBy': 'user:1',
        'grafana.app/updatedBy': 'user:2',
        ...(repoName
          ? {
              [AnnoKeyManagerKind]: ManagerKind.Repo,
              [AnnoKeyManagerIdentity]: repoName,
            }
          : {}),
      },
    },
    spec: { title: 'Test Folder', description: '' },
  };
}

function makeSettingsResponse(repos: RepositoryView[]) {
  return { items: repos, allowImageRendering: true, availableRepositoryTypes: ['github'] };
}

function setupRepoState({
  isProvisioned = false,
  isReadOnlyRepo = false,
  isOrphaned = false,
  isLoading = false,
  isError = false,
}: {
  isProvisioned?: boolean;
  isReadOnlyRepo?: boolean;
  isOrphaned?: boolean;
  isLoading?: boolean;
  isError?: boolean;
} = {}) {
  if (isLoading) {
    server.use(
      http.get(`${BASE}/settings`, async () => {
        await delay('infinite');
        return HttpResponse.json(makeSettingsResponse([]));
      })
    );
    return;
  }

  if (isError) {
    server.use(
      http.get(`${BASE}/settings`, () => HttpResponse.json({ message: 'settings fetch failed' }, { status: 500 }))
    );
    return;
  }

  if (isProvisioned || isReadOnlyRepo) {
    const repo: RepositoryView = {
      ...mockRepository,
      workflows: isReadOnlyRepo ? [] : ['write', 'branch'],
    };
    server.use(
      http.get(`${BASE}/settings`, () => HttpResponse.json(makeSettingsResponse([repo]))),
      http.get(`${FOLDER_BASE}/folders/:folderUid`, ({ params }) =>
        HttpResponse.json(makeFolderResponse(params.folderUid as string, 'test-repo'))
      )
    );
    return;
  }

  if (isOrphaned) {
    // Settings has repos, but NOT the one the folder's annotation references → orphaned
    server.use(
      http.get(`${BASE}/settings`, () => HttpResponse.json(makeSettingsResponse([mockRepository]))),
      http.get(`${FOLDER_BASE}/folders/:folderUid`, ({ params }) =>
        HttpResponse.json(makeFolderResponse(params.folderUid as string, 'dead-repo'))
      )
    );
    return;
  }

  // Non-provisioned default: no repos, plain folder
  server.use(
    http.get(`${FOLDER_BASE}/folders/:folderUid`, ({ params }) =>
      HttpResponse.json(makeFolderResponse(params.folderUid as string))
    )
  );
}

function defaultArgs(overrides: Partial<UseProvisionedImportArgs> = {}): UseProvisionedImportArgs {
  return {
    folderUid: 'folder-1',
    getDefaultTitle: jest.fn().mockReturnValue('Test Dashboard'),
    setValue: jest.fn(),
    ...overrides,
  };
}

// --- Tests ---

describe('useProvisionedImport', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    config.featureToggles.provisioning = true;
    mockUseImportProvisionedSave.mockReturnValue({
      save: mockSave,
      isLoading: false,
      error: undefined,
    });
  });

  afterEach(() => {
    config.featureToggles.provisioning = false;
  });

  it('returns isProvisioned=false when status is not Ready', async () => {
    setupRepoState({ isLoading: true });
    const { result } = renderHook(() => useProvisionedImport(defaultArgs()), {
      wrapper: getWrapper({ renderWithRouter: true }),
    });

    // Hook stays in loading state because settings query never resolves
    await waitFor(() => {
      expect(result.current.isRepoLoading).toBe(true);
    });

    expect(result.current.isProvisioned).toBe(false);
    expect(result.current.submitDisabled).toBe(true);
  });

  it('returns isOrphaned=true and shouldRenderProvisionedFields=true when orphaned', async () => {
    setupRepoState({ isOrphaned: true });
    const { result } = renderHook(() => useProvisionedImport(defaultArgs()), {
      wrapper: getWrapper({ renderWithRouter: true }),
    });

    await waitFor(() => {
      expect(result.current.isOrphaned).toBe(true);
    });

    expect(result.current.shouldRenderProvisionedFields).toBe(true);
    expect(result.current.submitDisabled).toBe(true);
  });

  it('returns isProvisioned=true when status is Ready with repository', async () => {
    setupRepoState({ isProvisioned: true });
    const { result } = renderHook(() => useProvisionedImport(defaultArgs()), {
      wrapper: getWrapper({ renderWithRouter: true }),
    });

    await waitFor(() => {
      expect(result.current.isProvisioned).toBe(true);
    });

    expect(result.current.shouldRenderProvisionedFields).toBe(true);
    expect(result.current.submitDisabled).toBe(false);
  });

  it('applies defaults once when provisioned', async () => {
    setupRepoState({ isProvisioned: true });
    const setValueSpy = jest.fn();
    renderHook(() => useProvisionedImport(defaultArgs({ setValue: setValueSpy })), {
      wrapper: getWrapper({ renderWithRouter: true }),
    });

    await waitFor(() => {
      expect(setValueSpy).toHaveBeenCalled();
    });

    expect(setValueSpy).toHaveBeenCalledWith('workflow', 'write', { shouldDirty: false });
    expect(setValueSpy).toHaveBeenCalledWith('ref', 'main', { shouldDirty: false });
    expect(setValueSpy).toHaveBeenCalledWith('path', 'test-dashboard.json', { shouldDirty: false });
    expect(setValueSpy).toHaveBeenCalledWith('repo', 'test-repo', { shouldDirty: false });
    // Exactly 4 calls — one per provisioning field, seeded once
    expect(setValueSpy).toHaveBeenCalledTimes(4);
  });

  it('reapplies defaults when repository changes', async () => {
    const setValueSpy = jest.fn();
    const otherRepo: RepositoryView = { ...mockRepository, name: 'other-repo' };

    // Set up both repos in settings; folder handler returns per-folder annotations
    server.use(
      http.get(`${BASE}/settings`, () => HttpResponse.json(makeSettingsResponse([mockRepository, otherRepo]))),
      http.get(`${FOLDER_BASE}/folders/:folderUid`, ({ params }) => {
        const uid = params.folderUid as string;
        const repoName = uid === 'folder-1' ? 'test-repo' : 'other-repo';
        return HttpResponse.json(makeFolderResponse(uid, repoName));
      })
    );

    const { rerender } = renderHook((props: UseProvisionedImportArgs) => useProvisionedImport(props), {
      initialProps: defaultArgs({ setValue: setValueSpy }),
      wrapper: getWrapper({ renderWithRouter: true }),
    });

    await waitFor(() => {
      expect(setValueSpy).toHaveBeenCalledTimes(4);
    });

    // Simulate folder change to a different repo
    rerender(defaultArgs({ setValue: setValueSpy, folderUid: 'folder-2' }));

    await waitFor(() => {
      expect(setValueSpy).toHaveBeenCalledTimes(8);
    });
  });

  it('does not reseed defaults when only getDefaultTitle return value changes', async () => {
    const setValueSpy = jest.fn();
    // Stable callback identity — the function always returns the same reference
    const stableGetTitle = jest.fn().mockReturnValue('Title A');
    setupRepoState({ isProvisioned: true });

    const { rerender } = renderHook((props: UseProvisionedImportArgs) => useProvisionedImport(props), {
      initialProps: defaultArgs({ setValue: setValueSpy, getDefaultTitle: stableGetTitle }),
      wrapper: getWrapper({ renderWithRouter: true }),
    });

    await waitFor(() => {
      expect(setValueSpy).toHaveBeenCalledTimes(4);
    });

    // Title changes but callback identity is stable
    stableGetTitle.mockReturnValue('Title B');
    rerender(defaultArgs({ setValue: setValueSpy, getDefaultTitle: stableGetTitle }));

    // Should NOT re-call because the callback reference didn't change
    // Wait a tick to confirm no additional call
    await new Promise((r) => setTimeout(r, 50));
    expect(setValueSpy).toHaveBeenCalledTimes(4);
  });

  it('returns isLibraryPanelImportBlocked=true and submitDisabled=true when hasLibraryPanels', async () => {
    setupRepoState({ isProvisioned: true });
    const { result } = renderHook(() => useProvisionedImport(defaultArgs({ hasLibraryPanels: true })), {
      wrapper: getWrapper({ renderWithRouter: true }),
    });

    await waitFor(() => {
      expect(result.current.isProvisioned).toBe(true);
    });

    expect(result.current.isLibraryPanelImportBlocked).toBe(true);
    expect(result.current.submitDisabled).toBe(true);
  });

  it('returns submitDisabled=true when read-only repo', async () => {
    setupRepoState({ isProvisioned: true, isReadOnlyRepo: true });
    const { result } = renderHook(() => useProvisionedImport(defaultArgs()), {
      wrapper: getWrapper({ renderWithRouter: true }),
    });

    await waitFor(() => {
      expect(result.current.isReadOnlyRepo).toBe(true);
    });

    expect(result.current.submitDisabled).toBe(true);
  });

  it('returns submitDisabled=true when repo lookup errors', async () => {
    setupRepoState({ isError: true });
    const { result } = renderHook(() => useProvisionedImport(defaultArgs()), {
      wrapper: getWrapper({ renderWithRouter: true }),
    });

    await waitFor(() => {
      expect(result.current.submitDisabled).toBe(true);
    });

    expect(result.current.isProvisioned).toBe(false);
  });

  it('forwards save from useImportProvisionedSave', async () => {
    setupRepoState({ isProvisioned: true });
    const { result } = renderHook(() => useProvisionedImport(defaultArgs()), {
      wrapper: getWrapper({ renderWithRouter: true }),
    });

    await waitFor(() => {
      expect(result.current.isProvisioned).toBe(true);
    });

    expect(result.current.save).toBe(mockSave);
  });

  it('forwards error from useImportProvisionedSave', async () => {
    setupRepoState({ isProvisioned: true });
    mockUseImportProvisionedSave.mockReturnValue({
      save: mockSave,
      isLoading: false,
      error: 'save failed',
    });
    const { result } = renderHook(() => useProvisionedImport(defaultArgs()), {
      wrapper: getWrapper({ renderWithRouter: true }),
    });

    await waitFor(() => {
      expect(result.current.isProvisioned).toBe(true);
    });

    expect(result.current.error).toBe('save failed');
  });

  it('detects instance-level provisioning when folderUid is empty string', async () => {
    // Instance-level repo (target: instance, not folder)
    const instanceRepo: RepositoryView = {
      ...mockRepository,
      name: 'instance-repo',
      target: 'instance',
    };

    server.use(http.get(`${BASE}/settings`, () => HttpResponse.json(makeSettingsResponse([instanceRepo]))));

    const { result } = renderHook(() => useProvisionedImport(defaultArgs({ folderUid: '' })), {
      wrapper: getWrapper({ renderWithRouter: true }),
    });

    await waitFor(() => {
      expect(result.current.isProvisioned).toBe(true);
    });

    expect(result.current.repository?.name).toBe('instance-repo');
  });
});
