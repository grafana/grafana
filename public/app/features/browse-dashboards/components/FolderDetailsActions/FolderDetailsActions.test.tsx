import { HttpResponse, http } from 'msw';
import { render, screen, testWithFeatureToggles, waitFor } from 'test/test-utils';

import { selectors } from '@grafana/e2e-selectors';
import { config, setBackendSrv } from '@grafana/runtime';
import { PROVISIONING_API_BASE as PROVISIONING_BASE } from '@grafana/test-utils/handlers';
import server, { setupMockServer } from '@grafana/test-utils/server';
import { getFolderFixtures, setTestFlags } from '@grafana/test-utils/unstable';
import { type CombinedFolder } from 'app/api/clients/folder/v1beta1/hooks';
import { backendSrv } from 'app/core/services/backend_srv';
import { contextSrv } from 'app/core/services/context_srv';
import { STARRED_FOLDERS_UID } from 'app/features/search/constants';
import { useSelector } from 'app/types/store';

import { FolderDetailsActions } from './FolderDetailsActions';

const [, { folderA }] = getFolderFixtures();
const folderToStar = folderA.item;

setBackendSrv(backendSrv);
setupMockServer();

// Renders the starred-folders collection straight from the browse-dashboards store, mirroring what
// the browse list shows. Lets the test assert on rendered output instead of redux internals.
const StarredFoldersList = () => {
  const collection = useSelector((state) => state.browseDashboards.childrenByParentUID[STARRED_FOLDERS_UID]);
  return (
    <ul>
      {collection?.items.map((item) => (
        <li key={item.uid}>{item.title}</li>
      ))}
    </ul>
  );
};

describe('FolderDetailsActions', () => {
  // starredFoldersEnabled() gates the star button on this feature toggle plus the OpenFeature flag
  testWithFeatureToggles({ enable: ['foldersAppPlatformAPI'] });

  beforeEach(() => {
    setTestFlags({ 'grafana.starredFolders': true });
  });

  afterEach(() => {
    setTestFlags({});
  });

  it('refetches the starred folders list when a folder is starred', async () => {
    const { user } = render(
      <>
        <FolderDetailsActions folderDTO={folderToStar as unknown as CombinedFolder} />
        <StarredFoldersList />
      </>
    );

    // The folder isn't in the starred-folders list yet
    expect(screen.queryByText(folderToStar.title)).not.toBeInTheDocument();

    const starButton = await screen.findByTestId(selectors.components.NavToolbar.markAsFavorite);
    await waitFor(() => expect(starButton).not.toBeDisabled());
    await user.click(starButton);

    // Starring triggers a refetch that adds the folder to the rendered list
    expect(await screen.findByText(folderToStar.title)).toBeInTheDocument();
  });

  describe('with a read-only folderless repository configured', () => {
    let originalProvisioning: boolean;

    beforeEach(() => {
      originalProvisioning = config.provisioningEnabled;
      config.provisioningEnabled = true;
      jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(true);
      server.use(
        http.get(`${PROVISIONING_BASE}/settings`, () =>
          HttpResponse.json({
            items: [
              { name: 'folderless-repo', title: 'Folderless', type: 'github', target: 'folderless', workflows: [] },
            ],
          })
        )
      );
    });

    afterEach(() => {
      config.provisioningEnabled = originalProvisioning;
      jest.restoreAllMocks();
    });

    // This resolves no repository at the root on purpose. Creating a folder in the Grafana database
    // is still valid there, so a read-only Git repo must not disable the whole New menu
    it('leaves the New button enabled at the root', async () => {
      render(<FolderDetailsActions />);

      const newButton = await screen.findByTestId(selectors.components.CreateNewButton.newButton);
      await waitFor(() => expect(newButton).toBeEnabled());
    });
  });
});
