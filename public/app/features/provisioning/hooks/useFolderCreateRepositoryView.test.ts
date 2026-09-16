import { renderHook, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { getWrapper } from 'test/test-utils';

import { config } from '@grafana/runtime';
import { FOLDER_BY_NAME_URL, PROVISIONING_API_BASE as BASE } from '@grafana/test-utils/handlers';
import server from '@grafana/test-utils/server';
import { type RepositoryView } from 'app/api/clients/provisioning/v0alpha1';
import { AnnoKeyManagerIdentity, AnnoKeyManagerKind, ManagerKind } from 'app/features/apiserver/types';
import { type FolderDTO } from 'app/types/folders';

import { setupProvisioningMswServer } from '../mocks/server';

import { useFolderCreateRepositoryView } from './useFolderCreateRepositoryView';

setupProvisioningMswServer();

const FOLDERLESS_REPO: RepositoryView = {
  name: 'folderless-repo',
  title: 'Folderless Repo',
  type: 'github',
  target: 'folderless',
  workflows: ['write', 'branch'],
};

const INSTANCE_REPO: RepositoryView = {
  name: 'instance-repo',
  title: 'Instance Repo',
  type: 'github',
  target: 'instance',
  workflows: ['write'],
};

const FOLDER_REPO: RepositoryView = {
  name: 'folder-repo',
  title: 'Folder Repo',
  type: 'github',
  target: 'folder',
  workflows: ['write'],
};

/** Override the frontend settings endpoint `useGetResourceRepositoryView` reads from. */
function mockRepositories(items: RepositoryView[]) {
  server.use(http.get(`${BASE}/settings`, () => HttpResponse.json({ items })));
}

/** Override the folder endpoint the subfolder lookup reads the manager annotation from. */
function mockFolder(uid: string, managedByRepo?: string) {
  server.use(
    http.get(FOLDER_BY_NAME_URL, () =>
      HttpResponse.json({
        metadata: {
          name: uid,
          annotations: managedByRepo
            ? { [AnnoKeyManagerKind]: ManagerKind.Repo, [AnnoKeyManagerIdentity]: managedByRepo }
            : {},
        },
        spec: { title: uid },
      })
    )
  );
}

function folderDTO(overrides: Partial<FolderDTO> = {}): FolderDTO {
  return { uid: 'folder-1', title: 'Folder 1', managedBy: undefined, ...overrides } as FolderDTO;
}

function renderView(parentFolder?: FolderDTO) {
  return renderHook(() => useFolderCreateRepositoryView(parentFolder), { wrapper: getWrapper({}) });
}

describe('useFolderCreateRepositoryView', () => {
  let originalProvisioning: boolean;

  beforeEach(() => {
    originalProvisioning = config.provisioningEnabled;
    config.provisioningEnabled = true;
  });

  afterEach(() => {
    config.provisioningEnabled = originalProvisioning;
  });

  describe('at the root', () => {
    it('resolves a folderless repository and offers the choice of target', async () => {
      mockRepositories([FOLDERLESS_REPO]);

      const { result } = renderView();

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current).toMatchObject({ isProvisioned: true, canChooseTarget: true, isError: false });
    });

    it('resolves an instance repository but offers no choice, the database is not a valid target under one', async () => {
      mockRepositories([INSTANCE_REPO]);

      const { result } = renderView();

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current).toMatchObject({ isProvisioned: true, canChooseTarget: false });
    });

    it('prefers the instance repository when both are configured', async () => {
      mockRepositories([FOLDERLESS_REPO, INSTANCE_REPO]);

      const { result } = renderView();

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current).toMatchObject({ isProvisioned: true, canChooseTarget: false });
    });

    it('does not resolve a folder-target repository', async () => {
      mockRepositories([FOLDER_REPO]);

      const { result } = renderView();

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current).toMatchObject({ isProvisioned: false, canChooseTarget: false });
    });

    it('is not provisioned when no repository is configured', async () => {
      mockRepositories([]);

      const { result } = renderView();

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current).toMatchObject({ isProvisioned: false, canChooseTarget: false, isError: false });
    });

    it('reports loading, and not "not provisioned", while the lookup is in flight', async () => {
      mockRepositories([FOLDERLESS_REPO]);

      const { result } = renderView();

      // The first render must never claim a decision the lookup has not made yet
      expect(result.current).toMatchObject({ isLoading: true, isProvisioned: false, canChooseTarget: false });
      await waitFor(() => expect(result.current.isProvisioned).toBe(true));
    });

    it('reports the failure rather than silently falling through to the database', async () => {
      server.use(http.get(`${BASE}/settings`, () => HttpResponse.json({ message: 'boom' }, { status: 500 })));

      const { result } = renderView();

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current).toMatchObject({ isLoading: false, isProvisioned: false, canChooseTarget: false });
      expect(result.current.error).toBeDefined();
    });

    it('falls through to the database when the caller may not read provisioning settings', async () => {
      // A folder Admin with no basic role gets 403 here. Provisioning is irrelevant to them, so the
      // lookup settles as "not provisioned" rather than failing closed and blocking folder creation
      server.use(http.get(`${BASE}/settings`, () => HttpResponse.json({ message: 'forbidden' }, { status: 403 })));

      const { result } = renderView();

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current).toMatchObject({ isProvisioned: false, canChooseTarget: false, isError: false });
    });

    it('is not provisioned when provisioning is disabled', async () => {
      config.provisioningEnabled = false;
      mockRepositories([FOLDERLESS_REPO]);

      const { result } = renderView();

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current).toMatchObject({ isProvisioned: false, canChooseTarget: false, isError: false });
    });
  });

  describe('inside a folder', () => {
    it('resolves the repository managing the parent, with no choice of target', async () => {
      mockRepositories([FOLDER_REPO]);
      mockFolder('folder-1', FOLDER_REPO.name);

      const { result } = renderView(folderDTO({ managedBy: ManagerKind.Repo }));

      await waitFor(() => expect(result.current.isProvisioned).toBe(true));
      expect(result.current).toMatchObject({ canChooseTarget: false, isError: false });
    });

    it('keeps a repository-managed parent on the provisioned path while the lookup is in flight', () => {
      mockRepositories([FOLDER_REPO]);
      mockFolder('folder-1', FOLDER_REPO.name);

      const { result } = renderView(folderDTO({ managedBy: ManagerKind.Repo }));

      // Settled from the parent's own annotation, so a slow lookup cannot route it to the database form
      expect(result.current).toMatchObject({ isLoading: false, isProvisioned: true });
    });

    it('keeps a parent whose repository was deleted off the database form', async () => {
      mockRepositories([FOLDERLESS_REPO]);
      mockFolder('folder-1', 'deleted-repo');

      const { result } = renderView(folderDTO({ managedBy: ManagerKind.Repo }));

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current).toMatchObject({ isProvisioned: true, canChooseTarget: false });
    });

    it('does not offer a folderless repository to an unmanaged folder', async () => {
      mockRepositories([FOLDERLESS_REPO]);
      mockFolder('folder-1');

      const { result } = renderView(folderDTO());

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current).toMatchObject({ isProvisioned: false, canChooseTarget: false });
    });

    it('resolves an instance repository for an unmanaged folder', async () => {
      mockRepositories([INSTANCE_REPO]);
      mockFolder('folder-1');

      const { result } = renderView(folderDTO());

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current).toMatchObject({ isProvisioned: true, canChooseTarget: false });
    });
  });
});
