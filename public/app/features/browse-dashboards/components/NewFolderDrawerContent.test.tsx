import { HttpResponse, http } from 'msw';
import { render, screen } from 'test/test-utils';

import { selectors } from '@grafana/e2e-selectors';
import { config } from '@grafana/runtime';
import { FOLDER_BY_NAME_URL, PROVISIONING_API_BASE as BASE } from '@grafana/test-utils/handlers';
import server from '@grafana/test-utils/server';
import { type RepositoryView } from 'app/api/clients/provisioning/v0alpha1';
import { AnnoKeyManagerIdentity, AnnoKeyManagerKind, ManagerKind } from 'app/features/apiserver/types';
import { setupProvisioningMswServer } from 'app/features/provisioning/mocks/server';
import { type FolderDTO } from 'app/types/folders';

import { mockFolderDTO } from '../fixtures/folder.fixture';

import { NewFolderDrawerContent } from './NewFolderDrawerContent';

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

/** Override the frontend settings endpoint the repository lookup reads from. */
function mockRepositories(items: RepositoryView[], settle?: () => Promise<unknown>) {
  server.use(
    http.get(`${BASE}/settings`, async () => {
      await settle?.();
      return HttpResponse.json({ items });
    })
  );
}

/** Override the folder endpoint the subfolder lookup reads the manager annotation from. */
function mockFolder(managedByRepo?: string) {
  server.use(
    http.get(FOLDER_BY_NAME_URL, ({ params }) =>
      HttpResponse.json({
        metadata: {
          name: String(params.folderUid),
          annotations: managedByRepo
            ? { [AnnoKeyManagerKind]: ManagerKind.Repo, [AnnoKeyManagerIdentity]: managedByRepo }
            : {},
        },
        spec: { title: 'Parent Folder' },
      })
    )
  );
}

/** The Git form is the only one of the two with a commit comment field. */
const findGitForm = () => screen.findByRole('textbox', { name: /comment/i });
const queryGitForm = () => screen.queryByRole('textbox', { name: /comment/i });
const findDatabaseForm = () => screen.findByTestId(selectors.pages.BrowseDashboards.NewFolderForm.form);
const queryDatabaseForm = () => screen.queryByTestId(selectors.pages.BrowseDashboards.NewFolderForm.form);
const queryToDatabaseSwitch = () => screen.queryByRole('button', { name: 'Create in Grafana database instead' });

function setup(parentFolder?: FolderDTO) {
  return render(
    <NewFolderDrawerContent parentFolder={parentFolder} onDismiss={jest.fn()} onCreateDatabaseFolder={jest.fn()} />
  );
}

describe('NewFolderDrawerContent', () => {
  let originalProvisioning: boolean;

  beforeEach(() => {
    originalProvisioning = config.provisioningEnabled;
    config.provisioningEnabled = true;
  });

  afterEach(() => {
    config.provisioningEnabled = originalProvisioning;
  });

  describe('at the root', () => {
    it('creates through a folderless repository, with the database offered as an alternative', async () => {
      mockRepositories([FOLDERLESS_REPO]);

      setup();

      expect(await findGitForm()).toBeInTheDocument();
      expect(queryDatabaseForm()).not.toBeInTheDocument();
      expect(queryToDatabaseSwitch()).toBeInTheDocument();
    });

    it('switches between the repository and the database, and back', async () => {
      mockRepositories([FOLDERLESS_REPO]);

      const { user } = setup();
      await findGitForm();

      await user.click(screen.getByRole('button', { name: 'Create in Grafana database instead' }));
      expect(queryDatabaseForm()).toBeInTheDocument();
      expect(queryGitForm()).not.toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Create in Git repository instead' }));
      expect(await findGitForm()).toBeInTheDocument();
      expect(queryDatabaseForm()).not.toBeInTheDocument();
    });

    it('offers no choice under an instance repository, the database is not a valid target under one', async () => {
      mockRepositories([INSTANCE_REPO]);

      setup();

      expect(await findGitForm()).toBeInTheDocument();
      expect(queryToDatabaseSwitch()).not.toBeInTheDocument();
    });

    it('creates in the database when no repository is configured', async () => {
      mockRepositories([]);

      setup();

      expect(await findDatabaseForm()).toBeInTheDocument();
      expect(queryGitForm()).not.toBeInTheDocument();
      expect(queryToDatabaseSwitch()).not.toBeInTheDocument();
    });

    it('waits for the lookup instead of flashing the database form', async () => {
      // Created up front, not inside the handler: the request has not been made yet at the point the
      // assertions below release it
      let releaseSettings = () => {};
      const settled = new Promise<void>((resolve) => (releaseSettings = resolve));
      mockRepositories([FOLDERLESS_REPO], () => settled);

      setup();

      expect(screen.getByTestId('Spinner')).toBeInTheDocument();
      expect(queryDatabaseForm()).not.toBeInTheDocument();
      expect(queryGitForm()).not.toBeInTheDocument();

      releaseSettings();
      expect(await findGitForm()).toBeInTheDocument();
    });

    it('leaves the database reachable when the folderless repository is read only', async () => {
      mockRepositories([{ ...FOLDERLESS_REPO, workflows: [] }]);

      const { user } = setup();

      // The Git form dead-ends on a read-only repository, so the switch must stay outside it
      const toDatabase = await screen.findByRole('button', { name: 'Create in Grafana database instead' });
      expect(screen.getByText(/this repository is read only/i)).toBeInTheDocument();

      await user.click(toDatabase);
      expect(queryDatabaseForm()).toBeInTheDocument();
    });

    it('treats the general folder as the root', async () => {
      mockRepositories([FOLDERLESS_REPO]);

      setup(mockFolderDTO(1, { uid: 'general', managedBy: undefined }));

      expect(await findGitForm()).toBeInTheDocument();
      expect(queryToDatabaseSwitch()).toBeInTheDocument();
    });

    it('shows the lookup failure instead of silently offering only the database', async () => {
      server.use(http.get(`${BASE}/settings`, () => HttpResponse.json({ message: 'boom' }, { status: 500 })));

      setup();

      expect(await screen.findByText('Error loading form')).toBeInTheDocument();
      expect(queryDatabaseForm()).toBeInTheDocument();
    });
  });

  describe('inside a folder', () => {
    it('creates through the repository managing the parent, with no choice of target', async () => {
      // Folderless, so only the root check keeps the database switch hidden
      mockRepositories([FOLDERLESS_REPO]);
      mockFolder(FOLDERLESS_REPO.name);

      setup(mockFolderDTO(1, { managedBy: ManagerKind.Repo }));

      expect(await findGitForm()).toBeInTheDocument();
      expect(queryToDatabaseSwitch()).not.toBeInTheDocument();
    });

    it('does not offer a folderless repository inside an unmanaged folder', async () => {
      mockRepositories([FOLDERLESS_REPO]);
      mockFolder();

      setup(mockFolderDTO(1, { managedBy: undefined }));

      expect(await findDatabaseForm()).toBeInTheDocument();
      expect(queryGitForm()).not.toBeInTheDocument();
      expect(queryToDatabaseSwitch()).not.toBeInTheDocument();
    });

    it('keeps a repository-managed parent off the database form when the lookup fails', async () => {
      server.use(http.get(`${BASE}/settings`, () => HttpResponse.json({ message: 'boom' }, { status: 500 })));
      mockFolder(FOLDER_REPO.name);

      setup(mockFolderDTO(1, { managedBy: ManagerKind.Repo }));

      // Settled from the parent's own annotation, so a failed lookup dead-ends on the Git gate rather
      // than offering the database, which is not a valid target inside a managed folder
      expect(await screen.findByText('Error loading form')).toBeInTheDocument();
      expect(queryDatabaseForm()).not.toBeInTheDocument();
    });

    it('names the deleted repository of a managed parent rather than offering the database', async () => {
      mockRepositories([FOLDERLESS_REPO]);
      mockFolder('deleted-repo');

      setup(mockFolderDTO(1, { managedBy: ManagerKind.Repo }));

      expect(await screen.findByText('Provisioning repository no longer exists')).toBeInTheDocument();
      expect(queryDatabaseForm()).not.toBeInTheDocument();
    });
  });
});
