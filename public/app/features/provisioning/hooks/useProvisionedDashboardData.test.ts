import { act, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { getWrapper } from 'test/test-utils';

import { config } from '@grafana/runtime';
import { PROVISIONING_API_BASE as BASE } from '@grafana/test-utils/handlers';
import server from '@grafana/test-utils/server';
import { setTestFlags } from '@grafana/test-utils/unstable';
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
  config.provisioningEnabled = true;
});

afterEach(() => {
  config.provisioningEnabled = false;
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

  describe('enforced branch name template', () => {
    // write-first repo: without the enforced-template override the default workflow would be `write`.
    const enforcedSettings = {
      ...settingsWithRepo,
      items: [
        {
          ...settingsWithRepo.items[0],
          workflows: ['write', 'branch'],
          branchOptions: { enforceTemplate: true, nameTemplate: 'grafana/{{action}}' },
        },
      ],
    };

    afterEach(async () => {
      await act(async () => {
        setTestFlags({});
      });
    });

    it('switches to the branch workflow when the template is enforced and the flag is on', async () => {
      setTestFlags({ 'provisioning.gitConventions': true });
      server.use(
        http.get(`${BASE}/settings`, () => HttpResponse.json(enforcedSettings)),
        http.get(`${FOLDER_BASE}/folders/:name`, () => HttpResponse.json(folderResponse))
      );

      const dashboard = createDashboard();
      const { result } = renderHook(() => useProvisionedDashboardData(dashboard), {
        wrapper: getWrapper({ renderWithRouter: true }),
      });

      await waitFor(() => expect(result.current.repoDataStatus).toBe(RepoViewStatus.Ready));
      // The workflow is switched here; useBranchTemplate fills the actual template ref in the form.
      expect(result.current.defaultValues?.workflow).toBe('branch');
      // The ref follows the workflow: a branch default must never point at the configured branch.
      expect(result.current.defaultValues?.ref).toMatch(/^dashboard\//);
    });

    it('keeps the same defaultValues object across rerenders when the override applies', async () => {
      setTestFlags({ 'provisioning.gitConventions': true });
      server.use(
        http.get(`${BASE}/settings`, () => HttpResponse.json(enforcedSettings)),
        http.get(`${FOLDER_BASE}/folders/:name`, () => HttpResponse.json(folderResponse))
      );

      const dashboard = createDashboard();
      const { result, rerender } = renderHook(() => useProvisionedDashboardData(dashboard), {
        wrapper: getWrapper({ renderWithRouter: true }),
      });

      await waitFor(() => expect(result.current.repoDataStatus).toBe(RepoViewStatus.Ready));
      const initial = result.current.defaultValues;

      // The form resets to defaultValues whenever its identity changes, so a fresh object per render
      // would reset the form on every unrelated rerender.
      rerender();
      expect(result.current.defaultValues).toBe(initial);
    });

    it('keeps the default write workflow when the gitConventions flag is off', async () => {
      setTestFlags({ 'provisioning.gitConventions': false });
      server.use(
        http.get(`${BASE}/settings`, () => HttpResponse.json(enforcedSettings)),
        http.get(`${FOLDER_BASE}/folders/:name`, () => HttpResponse.json(folderResponse))
      );

      const dashboard = createDashboard();
      const { result } = renderHook(() => useProvisionedDashboardData(dashboard), {
        wrapper: getWrapper({ renderWithRouter: true }),
      });

      await waitFor(() => expect(result.current.repoDataStatus).toBe(RepoViewStatus.Ready));
      expect(result.current.defaultValues?.workflow).toBe('write');
    });

    it('keeps the default write workflow when enforcement has no usable template', async () => {
      setTestFlags({ 'provisioning.gitConventions': true });
      server.use(
        http.get(`${BASE}/settings`, () =>
          HttpResponse.json({
            ...settingsWithRepo,
            items: [
              {
                ...settingsWithRepo.items[0],
                workflows: ['write', 'branch'],
                // enforceTemplate set without a nameTemplate: useBranchTemplate stays inactive, so
                // the workflow must not switch (nothing to enforce).
                branchOptions: { enforceTemplate: true },
              },
            ],
          })
        ),
        http.get(`${FOLDER_BASE}/folders/:name`, () => HttpResponse.json(folderResponse))
      );

      const dashboard = createDashboard();
      const { result } = renderHook(() => useProvisionedDashboardData(dashboard), {
        wrapper: getWrapper({ renderWithRouter: true }),
      });

      await waitFor(() => expect(result.current.repoDataStatus).toBe(RepoViewStatus.Ready));
      expect(result.current.defaultValues?.workflow).toBe('write');
    });
  });

  describe('generated branch name', () => {
    // A rerender (e.g. from toggling a save option) must not regenerate the branch name: the form
    // resets to the defaults with keepDirtyValues, so a new name would replace the pristine field.
    it.each([
      { desc: 'the default branch workflow', recoverToNewBranch: undefined },
      { desc: 'the deleted-branch recovery', recoverToNewBranch: { fileExistsOnConfiguredBranch: true } },
    ])('stays stable across rerenders for $desc', async ({ recoverToNewBranch }) => {
      server.use(
        http.get(`${BASE}/settings`, () => HttpResponse.json(settingsWithRepo)),
        http.get(`${FOLDER_BASE}/folders/:name`, () => HttpResponse.json(folderResponse))
      );

      const dashboard = createDashboard();
      const { result, rerender } = renderHook(() => useProvisionedDashboardData(dashboard, false, recoverToNewBranch), {
        wrapper: getWrapper({ renderWithRouter: true }),
      });

      await waitFor(() => expect(result.current.repoDataStatus).toBe(RepoViewStatus.Ready));
      const initialRef = result.current.defaultValues?.ref;
      expect(result.current.defaultValues?.workflow).toBe('branch');
      expect(initialRef).toMatch(/^dashboard\//);

      rerender();
      expect(result.current.defaultValues?.ref).toBe(initialRef);
    });
  });

  describe('recoverToNewBranch', () => {
    it('defaults to a fresh branch even when the preview was loaded from a non-default ref', async () => {
      server.use(
        http.get(`${BASE}/settings`, () => HttpResponse.json(settingsWithRepo)),
        http.get(`${FOLDER_BASE}/folders/:name`, () => HttpResponse.json(folderResponse))
      );

      // Loaded from an explicit ref the defaults would otherwise pick the write workflow at that ref.
      const dashboard = createDashboard();
      const { result } = renderHook(
        () => useProvisionedDashboardData(dashboard, false, { fileExistsOnConfiguredBranch: true }),
        {
          wrapper: getWrapper({ renderWithRouter: true, historyOptions: { initialEntries: ['/?ref=feature-branch'] } }),
        }
      );

      await waitFor(() => expect(result.current.repoDataStatus).toBe(RepoViewStatus.Ready));
      expect(result.current.defaultValues?.workflow).toBe('branch');
      expect(result.current.defaultValues?.ref).toMatch(/^dashboard\//);
      expect(result.current.defaultValues?.ref).not.toBe('feature-branch');
    });
  });
});
