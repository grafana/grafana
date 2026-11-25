import { HttpResponse, http } from 'msw';
import { render, screen, waitFor } from 'test/test-utils';

import { selectors } from '@grafana/e2e-selectors';
import { config, setBackendSrv } from '@grafana/runtime';
import { PROVISIONING_API_BASE as PROVISIONING_BASE } from '@grafana/test-utils/handlers';
import server, { setupMockServer } from '@grafana/test-utils/server';
import { backendSrv } from 'app/core/services/backend_srv';
import { contextSrv } from 'app/core/services/context_srv';

import { FolderDetailsActions } from './FolderDetailsActions';

setBackendSrv(backendSrv);
setupMockServer();

describe('FolderDetailsActions', () => {
  it('hides the Recently deleted button when requested by the page navigation', () => {
    render(<FolderDetailsActions showRecentlyDeleted={false} />);

    expect(screen.queryByRole('link', { name: 'Recently deleted' })).not.toBeInTheDocument();
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
