import { renderHook, act } from '@testing-library/react';

import { type RepositoryView } from 'app/api/clients/provisioning/v0alpha1';
import { AnnoKeyFolder } from 'app/features/apiserver/types';
import { dashboardAPIVersionResolver } from 'app/features/dashboard/api/DashboardAPIVersionResolver';

import { useImportProvisionedSave, type ImportProvisionedSaveParams } from './useImportProvisionedSave';

const mockNavigate = jest.fn();
jest.mock('react-router-dom-v5-compat', () => ({
  ...jest.requireActual('react-router-dom-v5-compat'),
  useNavigate: () => mockNavigate,
}));

const mockCreateFile = jest.fn();
const mockRequest = { isLoading: false, isSuccess: false, isError: false };
jest.mock('./useCreateOrUpdateRepositoryFile', () => ({
  useCreateOrUpdateRepositoryFile: () => [mockCreateFile, mockRequest],
}));

jest.mock('./useProvisionedRequestHandler', () => ({
  useProvisionedRequestHandler: jest.fn(),
}));

jest.mock('./useLastBranch', () => ({
  useLastBranch: () => ({ getLastBranch: jest.fn(), setLastBranch: jest.fn() }),
}));

const repository: RepositoryView = {
  name: 'my-repo',
  type: 'github',
  target: 'folder',
  title: 'My Repo',
  branch: 'main',
  workflows: ['write', 'branch'],
};

describe('useImportProvisionedSave', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    dashboardAPIVersionResolver.set({ v1: 'v1', v2: 'v2' });
  });

  it('does not call createFile when repository is undefined', () => {
    const { result } = renderHook(() => useImportProvisionedSave({ repository: undefined }));

    act(() => {
      result.current.save(makeSaveParams());
    });

    expect(mockCreateFile).not.toHaveBeenCalled();
  });

  it('builds correct body for v1 dashboard import', () => {
    const { result } = renderHook(() => useImportProvisionedSave({ repository }));
    const spec = { title: 'My Dashboard', panels: [] };

    act(() => {
      result.current.save(
        makeSaveParams({
          spec,
          apiVersion: 'v1',
          uid: 'custom-uid',
          folderUid: 'folder-abc',
          title: 'My Dashboard',
          form: { ref: 'main', path: 'dashboards/my-dash.json', comment: 'Initial import', workflow: 'write' },
        })
      );
    });

    expect(mockCreateFile).toHaveBeenCalledTimes(1);
    const call = mockCreateFile.mock.calls[0][0];

    expect(call.name).toBe('my-repo');
    expect(call.path).toBe('dashboards/my-dash.json');
    // ref === repository.branch → should be undefined
    expect(call.ref).toBeUndefined();
    expect(call.message).toBe('Initial import');

    const body = call.body;
    expect(body.apiVersion).toBe('dashboard.grafana.app/v1');
    expect(body.kind).toBe('Dashboard');
    expect(body.metadata.name).toBe('custom-uid');
    expect(body.metadata.generateName).toBeUndefined();
    expect(body.metadata.annotations[AnnoKeyFolder]).toBe('folder-abc');
    expect(body.spec).toBe(spec);
  });

  it('builds correct body for v2 dashboard import', () => {
    const { result } = renderHook(() => useImportProvisionedSave({ repository }));
    const spec = { title: 'V2 Dash', layout: { kind: 'GridLayout', spec: { items: [] } } };

    act(() => {
      result.current.save(
        makeSaveParams({
          spec,
          apiVersion: 'v2',
          folderUid: 'folder-xyz',
          title: 'V2 Dash',
          form: { ref: 'feat-branch', path: 'v2-dash.json', workflow: 'branch' },
        })
      );
    });

    const call = mockCreateFile.mock.calls[0][0];
    const body = call.body;

    expect(body.apiVersion).toBe('dashboard.grafana.app/v2');
    expect(body.kind).toBe('Dashboard');
    // No uid provided → should use generateName
    expect(body.metadata.name).toBeUndefined();
    expect(body.metadata.generateName).toBe('d');
    expect(body.spec).toBe(spec);
    // Non-default branch → ref should be sent
    expect(call.ref).toBe('feat-branch');
  });

  it('uses default commit message when comment is empty', () => {
    const { result } = renderHook(() => useImportProvisionedSave({ repository }));

    act(() => {
      result.current.save(
        makeSaveParams({
          title: 'My Dash',
          form: { ref: 'main', path: 'test.json', comment: '', workflow: 'write' },
        })
      );
    });

    const call = mockCreateFile.mock.calls[0][0];
    expect(call.message).toBe('New dashboard: My Dash');
  });

  it('trims whitespace-only comment and falls back to default', () => {
    const { result } = renderHook(() => useImportProvisionedSave({ repository }));

    act(() => {
      result.current.save(
        makeSaveParams({
          title: 'My Dash',
          form: { ref: 'main', path: 'test.json', comment: '   ', workflow: 'write' },
        })
      );
    });

    const call = mockCreateFile.mock.calls[0][0];
    expect(call.message).toBe('New dashboard: My Dash');
  });

  it('honors repository commit template when comment is empty', () => {
    const repoWithTemplate: RepositoryView = {
      ...repository,
      commit: { singleResourceMessageTemplate: 'feat: {{title}}' },
    };
    const { result } = renderHook(() => useImportProvisionedSave({ repository: repoWithTemplate }));

    act(() => {
      result.current.save(
        makeSaveParams({
          title: 'My Dash',
          form: { ref: 'main', path: 'test.json', comment: '', workflow: 'write' },
        })
      );
    });

    const call = mockCreateFile.mock.calls[0][0];
    expect(call.message).toBe('feat: My Dash');
  });

  it('falls back to beta version when resolver has not been called', () => {
    dashboardAPIVersionResolver.reset();

    const { result } = renderHook(() => useImportProvisionedSave({ repository }));

    act(() => {
      result.current.save(makeSaveParams({ apiVersion: 'v1' }));
    });

    const body = mockCreateFile.mock.calls[0][0].body;
    expect(body.apiVersion).toBe('dashboard.grafana.app/v1beta1');
  });
});

function makeSaveParams(overrides?: Partial<ImportProvisionedSaveParams>): ImportProvisionedSaveParams {
  return {
    spec: { title: 'Test' },
    apiVersion: 'v1',
    folderUid: 'folder-1',
    title: 'Test',
    form: { ref: 'main', path: 'test.json', workflow: 'write' },
    ...overrides,
  };
}
