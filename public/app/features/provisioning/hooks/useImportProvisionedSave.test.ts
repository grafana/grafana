import { renderHook, act, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { getWrapper } from 'test/test-utils';

import { PROVISIONING_API_BASE as BASE } from '@grafana/test-utils/handlers';
import server from '@grafana/test-utils/server';
import { type RepositoryView } from 'app/api/clients/provisioning/v0alpha1';
import { AnnoKeyFolder } from 'app/features/apiserver/types';
import { dashboardAPIVersionResolver } from 'app/features/dashboard/api/DashboardAPIVersionResolver';

import { setupProvisioningMswServer } from '../mocks/server';

import { useImportProvisionedSave, type ImportProvisionedSaveParams } from './useImportProvisionedSave';

setupProvisioningMswServer();

const mockNavigate = jest.fn();
jest.mock('react-router-dom-v5-compat', () => ({
  ...jest.requireActual('react-router-dom-v5-compat'),
  useNavigate: () => mockNavigate,
}));

const repository: RepositoryView = {
  name: 'my-repo',
  type: 'github',
  target: 'folder',
  title: 'My Repo',
  branch: 'main',
  workflows: ['write', 'branch'],
};

let capturedRequest: { url: URL; body: unknown } | null = null;

function requireCapturedRequest(): { url: URL; body: unknown } {
  expect(capturedRequest).not.toBeNull();
  return capturedRequest as { url: URL; body: unknown };
}

function renderImportSaveHook(repo?: RepositoryView) {
  return renderHook(() => useImportProvisionedSave({ repository: repo }), {
    wrapper: getWrapper({ renderWithRouter: true }),
  });
}

describe('useImportProvisionedSave', () => {
  beforeEach(() => {
    capturedRequest = null;
    jest.clearAllMocks();
    dashboardAPIVersionResolver.set({ v1: 'v1', v2: 'v2' });

    server.use(
      http.post(`${BASE}/repositories/:name/files/*`, async ({ request }) => {
        const url = new URL(request.url);
        capturedRequest = { url, body: await request.json() };
        return HttpResponse.json({ resource: { upsert: {} } });
      })
    );
  });

  it('does not send a create-file request when repository is undefined', async () => {
    const { result } = renderImportSaveHook(undefined);

    await act(async () => {
      await result.current.save(makeSaveParams());
    });

    expect(capturedRequest).toBeNull();
  });

  it('builds correct body for v1 dashboard import', async () => {
    const spec = { title: 'My Dashboard', panels: [] };
    const { result } = renderImportSaveHook(repository);

    await act(async () => {
      await result.current.save(
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

    await waitFor(() => {
      expect(capturedRequest).not.toBeNull();
    });

    const req = requireCapturedRequest();
    expect(req.url.pathname).toContain('/repositories/my-repo/files/dashboards/my-dash.json');
    // ref === repository.branch → should not be sent
    expect(req.url.searchParams.get('ref')).toBeNull();
    expect(req.url.searchParams.get('message')).toBe('Initial import');

    const body = req.body as Record<string, unknown>;
    expect(body).toMatchObject({
      apiVersion: 'dashboard.grafana.app/v1',
      kind: 'Dashboard',
      spec,
    });
    const metadata = body.metadata as Record<string, unknown>;
    expect(metadata.name).toBe('custom-uid');
    expect(metadata.generateName).toBeUndefined();
    expect((metadata.annotations as Record<string, string>)[AnnoKeyFolder]).toBe('folder-abc');
  });

  it('builds correct body for v2 dashboard import', async () => {
    const spec = { title: 'V2 Dash', layout: { kind: 'GridLayout', spec: { items: [] } } };
    const { result } = renderImportSaveHook(repository);

    await act(async () => {
      await result.current.save(
        makeSaveParams({
          spec,
          apiVersion: 'v2',
          folderUid: 'folder-xyz',
          title: 'V2 Dash',
          form: { ref: 'feat-branch', path: 'v2-dash.json', workflow: 'branch' },
        })
      );
    });

    await waitFor(() => {
      expect(capturedRequest).not.toBeNull();
    });

    const req = requireCapturedRequest();
    expect(req.url.pathname).toContain('/repositories/my-repo/files/v2-dash.json');
    // Non-default branch → ref should be sent
    expect(req.url.searchParams.get('ref')).toBe('feat-branch');

    const body = req.body as Record<string, unknown>;
    expect(body).toMatchObject({
      apiVersion: 'dashboard.grafana.app/v2',
      kind: 'Dashboard',
      spec,
    });
    const metadata = body.metadata as Record<string, unknown>;
    // No uid provided → should use generateName
    expect(metadata.name).toBeUndefined();
    expect(metadata.generateName).toBe('d');
  });

  it('uses default commit message when comment is empty', async () => {
    const { result } = renderImportSaveHook(repository);

    await act(async () => {
      await result.current.save(
        makeSaveParams({
          title: 'My Dash',
          form: { ref: 'main', path: 'test.json', comment: '', workflow: 'write' },
        })
      );
    });

    await waitFor(() => {
      expect(capturedRequest).not.toBeNull();
    });

    const req = requireCapturedRequest();
    expect(req.url.searchParams.get('message')).toBe('Create resource: My Dash');
  });

  it('trims whitespace-only comment and falls back to default', async () => {
    const { result } = renderImportSaveHook(repository);

    await act(async () => {
      await result.current.save(
        makeSaveParams({
          title: 'My Dash',
          form: { ref: 'main', path: 'test.json', comment: '   ', workflow: 'write' },
        })
      );
    });

    await waitFor(() => {
      expect(capturedRequest).not.toBeNull();
    });

    const req = requireCapturedRequest();
    expect(req.url.searchParams.get('message')).toBe('Create resource: My Dash');
  });

  it('honors repository commit template when comment is empty', async () => {
    const repoWithTemplate: RepositoryView = {
      ...repository,
      commit: { singleResourceMessageTemplate: 'feat: {{title}}' },
    };
    const { result } = renderImportSaveHook(repoWithTemplate);

    await act(async () => {
      await result.current.save(
        makeSaveParams({
          title: 'My Dash',
          form: { ref: 'main', path: 'test.json', comment: '', workflow: 'write' },
        })
      );
    });

    await waitFor(() => {
      expect(capturedRequest).not.toBeNull();
    });

    const req = requireCapturedRequest();
    expect(req.url.searchParams.get('message')).toBe('feat: My Dash');
  });

  it('falls back to beta version when resolver has not been called', async () => {
    dashboardAPIVersionResolver.reset();

    // Discovery will hit /apis/dashboard.grafana.app/ — return 404 so it falls back to beta
    server.use(http.get('/apis/dashboard.grafana.app/', () => new HttpResponse(null, { status: 404 })));

    const { result } = renderImportSaveHook(repository);

    await act(async () => {
      await result.current.save(makeSaveParams({ apiVersion: 'v1' }));
    });

    await waitFor(() => {
      expect(capturedRequest).not.toBeNull();
    });

    const body = requireCapturedRequest().body as Record<string, unknown>;
    expect(body.apiVersion).toBe('dashboard.grafana.app/v1beta1');
  });

  describe('save outcomes', () => {
    it('navigates to the new dashboard after a write-workflow save', async () => {
      server.use(
        http.post(`${BASE}/repositories/:name/files/*`, () =>
          HttpResponse.json({ resource: { upsert: { metadata: { name: 'new-dash-uid' } } } })
        )
      );

      const { result } = renderImportSaveHook(repository);

      await act(async () => {
        await result.current.save(
          makeSaveParams({
            title: 'My Dashboard',
            form: { ref: 'main', path: 'dash.json', workflow: 'write' },
          })
        );
      });

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith(expect.stringContaining('/d/new-dash-uid/my-dashboard'));
      });
      expect(result.current.error).toBeUndefined();
    });

    it('falls back to the folder view when write-workflow save returns no dashboard uid', async () => {
      server.use(
        http.post(`${BASE}/repositories/:name/files/*`, () => HttpResponse.json({ resource: { upsert: {} } }))
      );

      const { result } = renderImportSaveHook(repository);

      await act(async () => {
        await result.current.save(
          makeSaveParams({
            folderUid: 'folder-abc',
            form: { ref: 'main', path: 'dash.json', workflow: 'write' },
          })
        );
      });

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/dashboards/f/folder-abc/');
      });
      expect(result.current.error).toBeUndefined();
    });

    it('navigates to the preview page after a branch-workflow save', async () => {
      server.use(
        http.post(`${BASE}/repositories/:name/files/*`, () =>
          HttpResponse.json({ ref: 'feat-branch', path: 'dash.json', resource: { upsert: {} } })
        )
      );

      const { result } = renderImportSaveHook(repository);

      await act(async () => {
        await result.current.save(
          makeSaveParams({
            form: { ref: 'feat-branch', path: 'dash.json', workflow: 'branch' },
          })
        );
      });

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith(
          '/dashboard/provisioning/my-repo/preview/dash.json?ref=feat-branch&repo_type=github'
        );
      });
      expect(result.current.error).toBeUndefined();
    });

    it('does not navigate when branch-workflow response is missing the ref', async () => {
      server.use(
        http.post(`${BASE}/repositories/:name/files/*`, () =>
          HttpResponse.json({ path: 'dash.json', resource: { upsert: {} } })
        )
      );

      const { result } = renderImportSaveHook(repository);

      await act(async () => {
        await result.current.save(
          makeSaveParams({
            form: { ref: 'feat-branch', path: 'dash.json', workflow: 'branch' },
          })
        );
      });

      expect(mockNavigate).not.toHaveBeenCalled();
      expect(result.current.error).toBeUndefined();
    });

    it('exposes the API error message when the create-file request fails', async () => {
      server.use(
        http.post(`${BASE}/repositories/:name/files/*`, () =>
          HttpResponse.json({ message: 'failed to push to remote' }, { status: 500 })
        )
      );

      const { result } = renderImportSaveHook(repository);

      await act(async () => {
        await result.current.save(makeSaveParams());
      });

      await waitFor(() => {
        expect(result.current.error).toBe('failed to push to remote');
      });
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('falls back to the HTTP status text when the failure body has no message', async () => {
      server.use(http.post(`${BASE}/repositories/:name/files/*`, () => new HttpResponse(null, { status: 500 })));

      const { result } = renderImportSaveHook(repository);

      await act(async () => {
        await result.current.save(makeSaveParams());
      });

      await waitFor(() => {
        // backendSrv fills in the status text when the error body has no message
        expect(result.current.error).toBe('Internal Server Error');
      });
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('clears a previous error on the next save attempt', async () => {
      server.use(
        http.post(`${BASE}/repositories/:name/files/*`, () => HttpResponse.json({ message: 'boom' }, { status: 500 }), {
          once: true,
        })
      );

      const { result } = renderImportSaveHook(repository);

      await act(async () => {
        await result.current.save(makeSaveParams());
      });
      await waitFor(() => {
        expect(result.current.error).toBe('boom');
      });

      // Second save hits the default success handler from beforeEach
      await act(async () => {
        await result.current.save(makeSaveParams());
      });
      await waitFor(() => {
        expect(result.current.error).toBeUndefined();
      });
    });
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
