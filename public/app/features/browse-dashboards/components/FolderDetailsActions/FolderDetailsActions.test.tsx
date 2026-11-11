import { HttpResponse, http } from 'msw';
import { act, render, screen, waitFor } from 'test/test-utils';

import { selectors } from '@grafana/e2e-selectors';
import { config, setBackendSrv, setStarsSrv } from '@grafana/runtime';
import { PROVISIONING_API_BASE as PROVISIONING_BASE } from '@grafana/test-utils/handlers';
import server, { setupMockServer } from '@grafana/test-utils/server';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { backendSrv } from 'app/core/services/backend_srv';
import { contextSrv } from 'app/core/services/context_srv';
import { CollectionsStarsSrv } from 'app/features/stars/service';
import { AccessControlAction } from 'app/types/accessControl';

import { FolderDetailsActions } from './FolderDetailsActions';

setBackendSrv(backendSrv);
// Stars go through the runtime service, which refuses signed-out callers
setStarsSrv(new CollectionsStarsSrv());
contextSrv.isSignedIn = true;
setupMockServer();

describe('FolderDetailsActions', () => {
  it('hides the Recently deleted button when requested by the page navigation', () => {
    render(<FolderDetailsActions showRecentlyDeleted={false} />);

    expect(screen.queryByRole('link', { name: 'Recently deleted' })).not.toBeInTheDocument();
  });
  describe('on mobile with mobileEditDeprecation enabled', () => {
    beforeEach(() => {
      setTestFlags({ 'grafana.mobileEditDeprecation': true });
    });

    afterEach(async () => {
      jest.restoreAllMocks();
      // Wrap in act() because setTestFlags fires OpenFeature events that trigger React state updates while the
      // component is still mounted.
      await act(async () => {
        setTestFlags({});
      });
    });

    it('hides the New button when the user cannot create folders', async () => {
      jest
        .spyOn(contextSrv, 'hasPermission')
        .mockImplementation((action) => action === AccessControlAction.DashboardsCreate);
      jest
        .spyOn(contextSrv, 'hasPermissionInMetadata')
        .mockImplementation((action) => action === AccessControlAction.DashboardsCreate);
      render(<FolderDetailsActions />);

      await screen.findByText('Recently deleted');
      expect(screen.queryByTestId(selectors.components.CreateNewButton.newButton)).not.toBeInTheDocument();
    });

    it('shows the New button after root permissions load when the user can create folders', async () => {
      jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(true);
      const metadataPermission = jest.spyOn(contextSrv, 'hasPermissionInMetadata').mockReturnValue(true);
      render(<FolderDetailsActions />);

      await waitFor(() =>
        expect(metadataPermission).toHaveBeenCalledWith(
          AccessControlAction.FoldersCreate,
          expect.objectContaining({ uid: 'general' })
        )
      );

      expect(screen.getByTestId(selectors.components.CreateNewButton.newButton)).toBeInTheDocument();
    });
  });

  describe('with a read-only folderless repository configured', () => {
    let originalProvisioning: boolean;

    beforeEach(() => {
      originalProvisioning = config.provisioningEnabled;
      config.provisioningEnabled = true;
      jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(true);
      jest.spyOn(contextSrv, 'hasPermissionInMetadata').mockReturnValue(true);
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
