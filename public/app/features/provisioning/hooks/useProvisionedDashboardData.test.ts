import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { getWrapper } from 'test/test-utils';

import { config } from '@grafana/runtime';
import { PROVISIONING_API_BASE as BASE } from '@grafana/test-utils/handlers';
import server from '@grafana/test-utils/server';
import {
  AnnoKeyManagerIdentity,
  AnnoKeyManagerKind,
  AnnoKeySourcePath,
  ManagerKind,
} from 'app/features/apiserver/types';
import { DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';

import { setupProvisioningMswServer } from '../mocks/server';

import { RepoViewStatus } from './useGetResourceRepositoryView';
import { useDefaultValues, useProvisionedDashboardData } from './useProvisionedDashboardData';

setupProvisioningMswServer();

const FOLDER_BASE = '/apis/folder.grafana.app/v1beta1/namespaces/:namespace';

const settingsWithRepo = {
  items: [
    {
      name: 'my-repo',
      title: 'My Repo',
      type: 'github',
      target: 'folder',
      branch: 'main',
      workflows: ['branch', 'write'],
    },
  ],
  allowImageRendering: true,
  availableRepositoryTypes: ['github'],
};

const folderResponse = {
  kind: 'Folder',
  apiVersion: 'folder.grafana.app/v1beta1',
  metadata: {
    name: 'test-folder',
    namespace: 'default',
    uid: 'test-folder',
    creationTimestamp: '2023-01-01T00:00:00Z',
    annotations: {
      [AnnoKeySourcePath]: 'dashboards',
    },
  },
  spec: { title: 'Test Folder', description: '' },
};

const mockMeta = {
  folderUid: 'test-folder',
  k8s: {
    annotations: {
      [AnnoKeyManagerKind]: ManagerKind.Repo,
      [AnnoKeyManagerIdentity]: 'my-repo',
      [AnnoKeySourcePath]: 'dashboards/test.json',
    },
  },
};

beforeEach(() => {
  config.featureToggles.provisioning = true;
});

afterEach(() => {
  config.featureToggles.provisioning = false;
});

describe('useDefaultValues', () => {
  it('returns Loading while settings are being fetched', async () => {
    server.use(
      http.get(`${BASE}/settings`, async () => {
        await new Promise((r) => setTimeout(r, 500));
        return HttpResponse.json(settingsWithRepo);
      })
    );

    const meta = {
      folderUid: 'test-folder',
      k8s: {
        annotations: {
          [AnnoKeyManagerKind]: ManagerKind.Repo,
          [AnnoKeyManagerIdentity]: 'my-repo',
          [AnnoKeySourcePath]: 'dashboards/test.json',
        },
      },
    };

    const { result } = renderHook(() => useDefaultValues({ meta, defaultTitle: 'Test Dashboard' }), {
      wrapper: getWrapper({}),
    });

    expect(result.current.status).toBe(RepoViewStatus.Loading);
    expect(result.current.values).toBeNull();
  });

  it('returns Error when the settings endpoint fails', async () => {
    server.use(http.get(`${BASE}/settings`, () => HttpResponse.json({ message: 'Forbidden' }, { status: 403 })));

    const { result } = renderHook(() => useDefaultValues({ meta: mockMeta, defaultTitle: 'Test Dashboard' }), {
      wrapper: getWrapper({}),
    });

    await waitFor(() => expect(result.current.status).toBe(RepoViewStatus.Error));
    expect(result.current.values).toBeNull();
    expect(result.current.error).toBeDefined();
  });

  it('returns Error when the folder endpoint fails', async () => {
    server.use(
      http.get(`${BASE}/settings`, () => HttpResponse.json(settingsWithRepo)),
      http.get(`${FOLDER_BASE}/folders/:name`, () => HttpResponse.json({ message: 'Not found' }, { status: 500 }))
    );

    const { result } = renderHook(() => useDefaultValues({ meta: mockMeta, defaultTitle: 'Test Dashboard' }), {
      wrapper: getWrapper({}),
    });

    await waitFor(() => expect(result.current.status).toBe(RepoViewStatus.Error));
    expect(result.current.values).toBeNull();
    expect(result.current.error).toBeDefined();
  });

  it('returns Orphaned with null values when no repository matches', async () => {
    server.use(
      http.get(`${BASE}/settings`, () =>
        HttpResponse.json({
          items: [],
          allowImageRendering: true,
          availableRepositoryTypes: ['github'],
        })
      ),
      http.get(`${FOLDER_BASE}/folders/:name`, () => HttpResponse.json(folderResponse))
    );

    const meta = {
      folderUid: 'test-folder',
      k8s: {
        annotations: {
          [AnnoKeyManagerKind]: ManagerKind.Repo,
          [AnnoKeyManagerIdentity]: 'unknown-repo',
          [AnnoKeySourcePath]: 'dashboards/test.json',
        },
      },
    };

    const { result } = renderHook(() => useDefaultValues({ meta, defaultTitle: 'Test Dashboard' }), {
      wrapper: getWrapper({}),
    });

    await waitFor(() => expect(result.current.status).toBe(RepoViewStatus.Orphaned));
    expect(result.current.values).toBeNull();
    expect(result.current.error).toBeUndefined();
  });

  it('returns Ready with form values when repository is resolved', async () => {
    server.use(
      http.get(`${BASE}/settings`, () => HttpResponse.json(settingsWithRepo)),
      http.get(`${FOLDER_BASE}/folders/:name`, () => HttpResponse.json(folderResponse))
    );

    const { result } = renderHook(() => useDefaultValues({ meta: mockMeta, defaultTitle: 'Test Dashboard' }), {
      wrapper: getWrapper({}),
    });

    await waitFor(() => expect(result.current.status).toBe(RepoViewStatus.Ready));
    expect(result.current.values).not.toBeNull();
    expect(result.current.values?.repo).toBe('my-repo');
    expect(result.current.values?.title).toBe('Test Dashboard');
    expect(result.current.repository?.name).toBe('my-repo');
  });
});

describe('useProvisionedDashboardData', () => {
  function createDashboard(meta = {}) {
    return new DashboardScene({
      title: 'Test Dashboard',
      uid: 'test-uid',
      description: 'A test dashboard',
      meta: {
        slug: 'test-dashboard',
        folderUid: 'test-folder',
        k8s: {
          annotations: {
            [AnnoKeyManagerKind]: ManagerKind.Repo,
            [AnnoKeyManagerIdentity]: 'my-repo',
            [AnnoKeySourcePath]: 'dashboards/test.json',
          },
        },
        ...meta,
      },
    });
  }

  it('propagates Loading status with null defaultValues', async () => {
    server.use(
      http.get(`${BASE}/settings`, async () => {
        await new Promise((r) => setTimeout(r, 500));
        return HttpResponse.json(settingsWithRepo);
      })
    );

    const dashboard = createDashboard();
    const { result } = renderHook(() => useProvisionedDashboardData(dashboard), {
      wrapper: getWrapper({ renderWithRouter: true }),
    });

    expect(result.current.repoDataStatus).toBe(RepoViewStatus.Loading);
    expect(result.current.defaultValues).toBeNull();
    expect(result.current.readOnly).toBe(true);
  });

  it('propagates Error status with the error object', async () => {
    server.use(http.get(`${BASE}/settings`, () => HttpResponse.json({ message: 'Forbidden' }, { status: 403 })));

    const dashboard = createDashboard();
    const { result } = renderHook(() => useProvisionedDashboardData(dashboard), {
      wrapper: getWrapper({ renderWithRouter: true }),
    });

    await waitFor(() => expect(result.current.repoDataStatus).toBe(RepoViewStatus.Error));
    expect(result.current.defaultValues).toBeNull();
    expect(result.current.error).toBeDefined();
  });

  it('returns Ready with populated defaultValues when resolved', async () => {
    server.use(
      http.get(`${BASE}/settings`, () => HttpResponse.json(settingsWithRepo)),
      http.get(`${FOLDER_BASE}/folders/:name`, () => HttpResponse.json(folderResponse))
    );

    const dashboard = createDashboard();
    const { result } = renderHook(() => useProvisionedDashboardData(dashboard), {
      wrapper: getWrapper({ renderWithRouter: true }),
    });

    await waitFor(() => expect(result.current.repoDataStatus).toBe(RepoViewStatus.Ready));
    expect(result.current.defaultValues).not.toBeNull();
    expect(result.current.defaultValues?.repo).toBe('my-repo');
    expect(result.current.repository?.name).toBe('my-repo');
    expect(result.current.readOnly).toBe(false);
  });
});
