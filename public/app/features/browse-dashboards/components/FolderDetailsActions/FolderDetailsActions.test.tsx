import { render, screen, testWithFeatureToggles, waitFor } from 'test/test-utils';

import { selectors } from '@grafana/e2e-selectors';
import { setBackendSrv } from '@grafana/runtime';
import { setupMockServer } from '@grafana/test-utils/server';
import { getFolderFixtures, setTestFlags } from '@grafana/test-utils/unstable';
import { type CombinedFolder } from 'app/api/clients/folder/v1beta1/hooks';
import { backendSrv } from 'app/core/services/backend_srv';
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
  // starredFoldersEnabled() gates the star button on these feature toggles plus the OpenFeature flag
  testWithFeatureToggles({ enable: ['starsFromAPIServer', 'foldersAppPlatformAPI'] });

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
});
