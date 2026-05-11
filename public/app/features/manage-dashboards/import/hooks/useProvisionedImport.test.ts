import { renderHook } from '@testing-library/react';

import { type RepositoryView } from 'app/api/clients/provisioning/v0alpha1';
import {
  useGetResourceRepositoryView,
  RepoViewStatus,
} from 'app/features/provisioning/hooks/useGetResourceRepositoryView';

import { useImportProvisionedSave } from './useImportProvisionedSave';
import { useProvisionedImport, type UseProvisionedImportArgs } from './useProvisionedImport';

// --- Mocks ---

jest.mock('app/features/provisioning/hooks/useGetResourceRepositoryView', () => ({
  useGetResourceRepositoryView: jest.fn(),
  RepoViewStatus: {
    Disabled: 'disabled',
    Loading: 'loading',
    Ready: 'ready',
    Error: 'error',
    Orphaned: 'orphaned',
  },
}));

jest.mock('./useImportProvisionedSave', () => ({
  useImportProvisionedSave: jest.fn(),
}));

jest.mock('app/features/provisioning/components/defaults', () => ({
  getDefaultWorkflow: jest.fn().mockReturnValue('write'),
  getDefaultRef: jest.fn().mockReturnValue('main'),
  getCanPushToConfiguredBranch: jest.fn().mockReturnValue(true),
}));

jest.mock('app/features/provisioning/components/utils/path', () => ({
  generatePath: jest.fn().mockReturnValue('test-dashboard.json'),
  slugifyForFilename: jest.fn().mockReturnValue('test-dashboard'),
}));

jest.mock('app/features/provisioning/components/utils/timestamp', () => ({
  generateTimestamp: jest.fn().mockReturnValue('2026-05-04-abc12'),
}));

const mockUseGetResourceRepositoryView = jest.mocked(useGetResourceRepositoryView);
const mockUseImportProvisionedSave = jest.mocked(useImportProvisionedSave);

// --- Helpers ---

const mockRepository: RepositoryView = {
  name: 'test-repo',
  branch: 'main',
  type: 'github',
  target: 'folder',
  title: 'Test Repo',
  workflows: ['write', 'branch'],
};

const mockSave = jest.fn();

function setupMock(
  overrides: Partial<ReturnType<typeof useGetResourceRepositoryView>> = {},
  saveOverrides: Partial<ReturnType<typeof useImportProvisionedSave>> = {}
) {
  mockUseGetResourceRepositoryView.mockReturnValue({
    status: RepoViewStatus.Ready,
    isLoading: false,
    isInstanceManaged: false,
    isReadOnlyRepo: false,
    ...overrides,
  });
  mockUseImportProvisionedSave.mockReturnValue({
    save: mockSave,
    isLoading: false,
    error: undefined,
    ...saveOverrides,
  });
}

function defaultArgs(overrides: Partial<UseProvisionedImportArgs> = {}): UseProvisionedImportArgs {
  return {
    folderUid: 'folder-1',
    getDefaultTitle: jest.fn().mockReturnValue('Test Dashboard'),
    applyDefaults: jest.fn(),
    ...overrides,
  };
}

// --- Tests ---

describe('useProvisionedImport', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns isProvisioned=false when status is not Ready', () => {
    setupMock({ status: RepoViewStatus.Loading, isLoading: true });
    const { result } = renderHook(() => useProvisionedImport(defaultArgs()));

    expect(result.current.isProvisioned).toBe(false);
    expect(result.current.isRepoLoading).toBe(true);
    expect(result.current.submitDisabled).toBe(true);
  });

  it('returns isOrphaned=true and shouldRenderProvisionedFields=true when orphaned', () => {
    setupMock({ status: RepoViewStatus.Orphaned });
    const { result } = renderHook(() => useProvisionedImport(defaultArgs()));

    expect(result.current.isOrphaned).toBe(true);
    expect(result.current.shouldRenderProvisionedFields).toBe(true);
    expect(result.current.submitDisabled).toBe(true);
  });

  it('returns isProvisioned=true when status is Ready with repository', () => {
    setupMock({ repository: mockRepository, status: RepoViewStatus.Ready });
    const { result } = renderHook(() => useProvisionedImport(defaultArgs()));

    expect(result.current.isProvisioned).toBe(true);
    expect(result.current.shouldRenderProvisionedFields).toBe(true);
    expect(result.current.submitDisabled).toBe(false);
  });

  it('applies defaults once when provisioned', () => {
    setupMock({ repository: mockRepository, status: RepoViewStatus.Ready });
    const applyDefaults = jest.fn();
    renderHook(() => useProvisionedImport(defaultArgs({ applyDefaults })));

    expect(applyDefaults).toHaveBeenCalledTimes(1);
    expect(applyDefaults).toHaveBeenCalledWith({
      workflow: 'write',
      ref: 'main',
      path: 'test-dashboard.json',
      repo: 'test-repo',
    });
  });

  it('reapplies defaults when repository changes', () => {
    const applyDefaults = jest.fn();
    setupMock({ repository: mockRepository, status: RepoViewStatus.Ready });

    const { rerender } = renderHook((props: UseProvisionedImportArgs) => useProvisionedImport(props), {
      initialProps: defaultArgs({ applyDefaults }),
    });

    expect(applyDefaults).toHaveBeenCalledTimes(1);

    // Simulate folder change to a different repo
    const newRepo: RepositoryView = { ...mockRepository, name: 'other-repo' };
    mockUseGetResourceRepositoryView.mockReturnValue({
      repository: newRepo,
      status: RepoViewStatus.Ready,
      isLoading: false,
      isInstanceManaged: false,
      isReadOnlyRepo: false,
    });
    rerender(defaultArgs({ applyDefaults, folderUid: 'folder-2' }));

    expect(applyDefaults).toHaveBeenCalledTimes(2);
  });

  it('does not reseed defaults when only getDefaultTitle return value changes', () => {
    const applyDefaults = jest.fn();
    // Stable callback identity — the function always returns the same reference
    const stableGetTitle = jest.fn().mockReturnValue('Title A');
    setupMock({ repository: mockRepository, status: RepoViewStatus.Ready });

    const { rerender } = renderHook((props: UseProvisionedImportArgs) => useProvisionedImport(props), {
      initialProps: defaultArgs({ applyDefaults, getDefaultTitle: stableGetTitle }),
    });

    expect(applyDefaults).toHaveBeenCalledTimes(1);

    // Title changes but callback identity is stable
    stableGetTitle.mockReturnValue('Title B');
    rerender(defaultArgs({ applyDefaults, getDefaultTitle: stableGetTitle }));

    // Should NOT re-call because the callback reference didn't change
    expect(applyDefaults).toHaveBeenCalledTimes(1);
  });

  it('returns isLPBlocked=true and submitDisabled=true when hasLibraryPanels', () => {
    setupMock({ repository: mockRepository, status: RepoViewStatus.Ready });
    const { result } = renderHook(() => useProvisionedImport(defaultArgs({ hasLibraryPanels: true })));

    expect(result.current.isLPBlocked).toBe(true);
    expect(result.current.submitDisabled).toBe(true);
  });

  it('returns submitDisabled=true when read-only repo', () => {
    setupMock({ repository: mockRepository, status: RepoViewStatus.Ready, isReadOnlyRepo: true });
    const { result } = renderHook(() => useProvisionedImport(defaultArgs()));

    expect(result.current.isReadOnlyRepo).toBe(true);
    expect(result.current.submitDisabled).toBe(true);
  });

  it('returns submitDisabled=true when repo lookup errors', () => {
    setupMock({ status: RepoViewStatus.Error, error: new Error('settings fetch failed') });
    const { result } = renderHook(() => useProvisionedImport(defaultArgs()));

    expect(result.current.isProvisioned).toBe(false);
    expect(result.current.submitDisabled).toBe(true);
  });

  it('forwards save from useImportProvisionedSave', () => {
    setupMock({ repository: mockRepository, status: RepoViewStatus.Ready });
    const { result } = renderHook(() => useProvisionedImport(defaultArgs()));

    expect(result.current.save).toBe(mockSave);
  });

  it('forwards error from useImportProvisionedSave', () => {
    setupMock({ repository: mockRepository, status: RepoViewStatus.Ready }, { error: 'save failed' });
    const { result } = renderHook(() => useProvisionedImport(defaultArgs()));

    expect(result.current.error).toBe('save failed');
  });
});
