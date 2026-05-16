import { HttpResponse, http } from 'msw';
import { renderHook, act, waitFor, getWrapper } from 'test/test-utils';

import { PROVISIONING_API_BASE as BASE } from '@grafana/test-utils/handlers';
import server from '@grafana/test-utils/server';
import { type RepositoryView } from 'app/api/clients/provisioning/v0alpha1';
import { AnnoKeyFolder } from 'app/features/apiserver/types';
import { dashboardAPIVersionResolver } from 'app/features/dashboard/api/DashboardAPIVersionResolver';
import { setupProvisioningMswServer } from 'app/features/provisioning/mocks/server';

import { useImportProvisionedSave, type ImportProvisionedSaveParams } from './useImportProvisionedSave';

// --- Mocks ---

jest.mock('app/features/provisioning/hooks/useProvisionedRequestHandler', () => ({
  useProvisionedRequestHandler: jest.fn(),
}));

setupProvisioningMswServer();

// --- Helpers ---

interface CapturedRequest {
  name: string | readonly string[];
  url: URL;
  body: unknown;
}

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

const wrapper = getWrapper({ renderWithRouter: true });

// --- Tests ---

describe('useImportProvisionedSave', () => {
  let capturedRequest: CapturedRequest | null = null;

  beforeEach(() => {
    jest.clearAllMocks();
    capturedRequest = null;
    dashboardAPIVersionResolver.set({ v1: 'v1beta1', v2: 'v2beta1' });

    server.use(
      http.post(`${BASE}/repositories/:name/files/*`, async ({ request, params }) => {
        const url = new URL(request.url);
        capturedRequest = { name: params.name, url, body: await request.json() };
        return HttpResponse.json({ resource: { upsert: {} } });
      })
    );
  });

  afterAll(() => {
    dashboardAPIVersionResolver.reset();
  });

  it('builds correct ResourceForCreate for V1 without UID override', async () => {
    const { result } = renderHook(() => useImportProvisionedSave({ repository: mockRepository }), { wrapper });

    act(() => {
      result.current.save(defaultSaveParams());
    });

    await waitFor(() => {
      expect(capturedRequest).not.toBeNull();
    });

    // Body shape
    expect(capturedRequest!.body).toEqual({
      apiVersion: 'dashboard.grafana.app/v1beta1',
      kind: 'Dashboard',
      metadata: {
        annotations: { [AnnoKeyFolder]: 'folder-abc' },
        generateName: 'd',
      },
      spec: { title: 'My Dashboard', panels: [] },
    });

    // No name when UID not provided
    expect(
      (capturedRequest!.body as Record<string, unknown> & { metadata: { name?: string } }).metadata.name
    ).toBeUndefined();
  });

  it('sets metadata.name when UID is provided', async () => {
    const { result } = renderHook(() => useImportProvisionedSave({ repository: mockRepository }), { wrapper });

    act(() => {
      result.current.save(defaultSaveParams({ uid: 'custom-uid' }));
    });

    await waitFor(() => {
      expect(capturedRequest).not.toBeNull();
    });

    const body = capturedRequest!.body as { metadata: { name?: string; generateName?: string } };
    expect(body.metadata.name).toBe('custom-uid');
    expect(body.metadata.generateName).toBeUndefined();
  });

  it('uses V2 API version when apiVersion is v2', async () => {
    const { result } = renderHook(() => useImportProvisionedSave({ repository: mockRepository }), { wrapper });

    act(() => {
      result.current.save(defaultSaveParams({ apiVersion: 'v2' }));
    });

    await waitFor(() => {
      expect(capturedRequest).not.toBeNull();
    });

    const body = capturedRequest!.body as { apiVersion: string };
    expect(body.apiVersion).toBe('dashboard.grafana.app/v2beta1');
  });

  it('omits ref when branch matches repository default', async () => {
    const { result } = renderHook(() => useImportProvisionedSave({ repository: mockRepository }), { wrapper });

    act(() => {
      result.current.save(defaultSaveParams({ form: { ref: 'main', path: 'test.json', workflow: 'write' } }));
    });

    await waitFor(() => {
      expect(capturedRequest).not.toBeNull();
    });

    expect(capturedRequest!.url.searchParams.get('ref')).toBeNull();
  });

  it('passes ref when branch differs from repository default', async () => {
    const { result } = renderHook(() => useImportProvisionedSave({ repository: mockRepository }), { wrapper });

    act(() => {
      result.current.save(
        defaultSaveParams({ form: { ref: 'feature-branch', path: 'test.json', workflow: 'branch' } })
      );
    });

    await waitFor(() => {
      expect(capturedRequest).not.toBeNull();
    });

    expect(capturedRequest!.url.searchParams.get('ref')).toBe('feature-branch');
  });

  it('uses custom comment as commit message', async () => {
    const { result } = renderHook(() => useImportProvisionedSave({ repository: mockRepository }), { wrapper });

    act(() => {
      result.current.save(
        defaultSaveParams({
          form: { ref: 'main', path: 'test.json', comment: 'Custom commit message', workflow: 'write' },
        })
      );
    });

    await waitFor(() => {
      expect(capturedRequest).not.toBeNull();
    });

    expect(capturedRequest!.url.searchParams.get('message')).toBe('Custom commit message');
  });

  it('generates default commit message from title when no comment', async () => {
    const { result } = renderHook(() => useImportProvisionedSave({ repository: mockRepository }), { wrapper });

    act(() => {
      result.current.save(defaultSaveParams({ title: 'Test Dashboard' }));
    });

    await waitFor(() => {
      expect(capturedRequest).not.toBeNull();
    });

    expect(capturedRequest!.url.searchParams.get('message')).toBe('Import dashboard: Test Dashboard');
  });

  it('passes correct repository name and path', async () => {
    const { result } = renderHook(() => useImportProvisionedSave({ repository: mockRepository }), { wrapper });

    act(() => {
      result.current.save(
        defaultSaveParams({ form: { ref: 'main', path: 'provisioning/dashboards/test.json', workflow: 'write' } })
      );
    });

    await waitFor(() => {
      expect(capturedRequest).not.toBeNull();
    });

    expect(capturedRequest!.name).toBe('test-repo');
    expect(capturedRequest!.url.pathname).toContain('/files/provisioning/dashboards/test.json');
  });

  it('clears error on new save', async () => {
    const { result } = renderHook(() => useImportProvisionedSave({ repository: mockRepository }), { wrapper });

    // Save should clear any previous error
    act(() => {
      result.current.save(defaultSaveParams());
    });

    expect(result.current.error).toBeUndefined();
  });

  it('is a no-op when repository is undefined', async () => {
    const { result } = renderHook(() => useImportProvisionedSave({ repository: undefined }), { wrapper });

    act(() => {
      result.current.save(defaultSaveParams());
    });

    // Give the test a tick to confirm no request was made
    await act(async () => {});
    expect(capturedRequest).toBeNull();
  });

  it('snapshots the active repository so navigation works after repo prop clears', async () => {
    const initialProps: { repo: RepositoryView | undefined } = { repo: mockRepository };
    const { result, rerender } = renderHook(({ repo }) => useImportProvisionedSave({ repository: repo }), {
      initialProps,
      wrapper,
    });

    act(() => {
      result.current.save(defaultSaveParams());
    });

    await waitFor(() => {
      expect(capturedRequest).not.toBeNull();
    });

    // Simulate the repository prop clearing (folder switch mid-save)
    rerender({ repo: undefined });

    // createFile was already called with the original repo name
    expect(capturedRequest!.name).toBe('test-repo');
  });
});
