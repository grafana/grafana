import { renderHook, act } from '@testing-library/react';

import { type RepositoryView } from 'app/api/clients/provisioning/v0alpha1';
import { AnnoKeyFolder } from 'app/features/apiserver/types';
import { dashboardAPIVersionResolver } from 'app/features/dashboard/api/DashboardAPIVersionResolver';

import { useImportProvisionedSave, type ImportProvisionedSaveParams } from './useImportProvisionedSave';

// --- Mocks ---

const mockNavigate = jest.fn();
jest.mock('react-router-dom-v5-compat', () => ({
  useNavigate: () => mockNavigate,
}));

const mockCreateFile = jest.fn();
jest.mock('app/features/provisioning/hooks/useCreateOrUpdateRepositoryFile', () => ({
  useCreateOrUpdateRepositoryFile: () => [mockCreateFile, { isLoading: false, isError: false, isSuccess: false }],
}));

jest.mock('app/features/provisioning/hooks/useProvisionedRequestHandler', () => ({
  useProvisionedRequestHandler: jest.fn(),
}));

jest.mock('app/features/provisioning/components/utils/errors', () => ({
  getProvisionedRequestError: jest.fn((_err: unknown, _type: string, fallback: string) => fallback),
}));

jest.mock('app/features/dashboard-scene/utils/getDashboardUrl', () => ({
  getDashboardUrl: jest.fn(() => '/d/test-uid/test-dashboard'),
}));

jest.mock('app/features/provisioning/utils/redirect', () => ({
  buildResourceBranchRedirectUrl: jest.fn(() => '/dashboard/provisioning/repo/preview/path?ref=feature-branch'),
}));

// --- Helpers ---

const mockRepository: RepositoryView = {
  name: 'test-repo',
  branch: 'main',
  type: 'github',
  target: 'folder',
  title: 'Test Repo',
  workflows: ['write', 'branch'],
};

function defaultSaveParams(overrides: Partial<ImportProvisionedSaveParams> = {}): ImportProvisionedSaveParams {
  return {
    spec: { title: 'My Dashboard', panels: [] },
    apiVersion: 'v1',
    folderUid: 'folder-abc',
    title: 'My Dashboard',
    form: {
      ref: 'main',
      path: 'dashboards/my-dashboard.json',
      workflow: 'write',
    },
    ...overrides,
  };
}

// --- Tests ---

describe('useImportProvisionedSave', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    dashboardAPIVersionResolver.set({ v1: 'v1beta1', v2: 'v2beta1' });
  });

  afterAll(() => {
    dashboardAPIVersionResolver.reset();
  });

  it('builds correct ResourceForCreate for V1 without UID override', () => {
    const { result } = renderHook(() => useImportProvisionedSave({ repository: mockRepository }));

    act(() => {
      result.current.save(defaultSaveParams());
    });

    expect(mockCreateFile).toHaveBeenCalledTimes(1);
    const callArgs = mockCreateFile.mock.calls[0][0];

    // Body shape
    expect(callArgs.body).toEqual({
      apiVersion: 'dashboard.grafana.app/v1beta1',
      kind: 'Dashboard',
      metadata: {
        annotations: { [AnnoKeyFolder]: 'folder-abc' },
        generateName: 'd',
      },
      spec: { title: 'My Dashboard', panels: [] },
    });

    // No name when UID not provided
    expect(callArgs.body.metadata.name).toBeUndefined();
  });

  it('sets metadata.name when UID is provided', () => {
    const { result } = renderHook(() => useImportProvisionedSave({ repository: mockRepository }));

    act(() => {
      result.current.save(defaultSaveParams({ uid: 'custom-uid' }));
    });

    const body = mockCreateFile.mock.calls[0][0].body;
    expect(body.metadata.name).toBe('custom-uid');
    expect(body.metadata.generateName).toBeUndefined();
  });

  it('uses V2 API version when apiVersion is v2', () => {
    const { result } = renderHook(() => useImportProvisionedSave({ repository: mockRepository }));

    act(() => {
      result.current.save(defaultSaveParams({ apiVersion: 'v2' }));
    });

    const body = mockCreateFile.mock.calls[0][0].body;
    expect(body.apiVersion).toBe('dashboard.grafana.app/v2beta1');
  });

  it('omits ref when branch matches repository default', () => {
    const { result } = renderHook(() => useImportProvisionedSave({ repository: mockRepository }));

    act(() => {
      result.current.save(defaultSaveParams({ form: { ref: 'main', path: 'test.json', workflow: 'write' } }));
    });

    expect(mockCreateFile.mock.calls[0][0].ref).toBeUndefined();
  });

  it('passes ref when branch differs from repository default', () => {
    const { result } = renderHook(() => useImportProvisionedSave({ repository: mockRepository }));

    act(() => {
      result.current.save(
        defaultSaveParams({ form: { ref: 'feature-branch', path: 'test.json', workflow: 'branch' } })
      );
    });

    expect(mockCreateFile.mock.calls[0][0].ref).toBe('feature-branch');
  });

  it('uses custom comment as commit message', () => {
    const { result } = renderHook(() => useImportProvisionedSave({ repository: mockRepository }));

    act(() => {
      result.current.save(
        defaultSaveParams({
          form: { ref: 'main', path: 'test.json', comment: 'Custom commit message', workflow: 'write' },
        })
      );
    });

    expect(mockCreateFile.mock.calls[0][0].message).toBe('Custom commit message');
  });

  it('generates default commit message from title when no comment', () => {
    const { result } = renderHook(() => useImportProvisionedSave({ repository: mockRepository }));

    act(() => {
      result.current.save(defaultSaveParams({ title: 'Test Dashboard' }));
    });

    expect(mockCreateFile.mock.calls[0][0].message).toBe('Import dashboard: Test Dashboard');
  });

  it('passes correct repository name and path', () => {
    const { result } = renderHook(() => useImportProvisionedSave({ repository: mockRepository }));

    act(() => {
      result.current.save(
        defaultSaveParams({ form: { ref: 'main', path: 'provisioning/dashboards/test.json', workflow: 'write' } })
      );
    });

    expect(mockCreateFile.mock.calls[0][0].name).toBe('test-repo');
    expect(mockCreateFile.mock.calls[0][0].path).toBe('provisioning/dashboards/test.json');
  });

  it('clears error on new save', () => {
    const { result } = renderHook(() => useImportProvisionedSave({ repository: mockRepository }));

    // Save should clear any previous error
    act(() => {
      result.current.save(defaultSaveParams());
    });

    expect(result.current.error).toBeUndefined();
  });

  it('is a no-op when repository is undefined', () => {
    const { result } = renderHook(() => useImportProvisionedSave({ repository: undefined }));

    act(() => {
      result.current.save(defaultSaveParams());
    });

    expect(mockCreateFile).not.toHaveBeenCalled();
  });

  it('snapshots the active repository so navigation works after repo prop clears', () => {
    const initialProps: { repo: RepositoryView | undefined } = { repo: mockRepository };
    const { result, rerender } = renderHook(({ repo }) => useImportProvisionedSave({ repository: repo }), {
      initialProps,
    });

    act(() => {
      result.current.save(defaultSaveParams());
    });

    expect(mockCreateFile).toHaveBeenCalledTimes(1);

    // Simulate the repository prop clearing (folder switch mid-save)
    rerender({ repo: undefined });

    // createFile was already called with the original repo name
    expect(mockCreateFile.mock.calls[0][0].name).toBe('test-repo');
  });
});
