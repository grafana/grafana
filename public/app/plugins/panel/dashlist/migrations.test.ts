import { HttpResponse, http } from 'msw';
import { wellFormedPanelModel } from 'test/fixtures/panelModel.fixture';

import { type PanelModel } from '@grafana/data';
import { setBackendSrv } from '@grafana/runtime';
import server, { setupMockServer } from '@grafana/test-utils/server';
import { backendSrv } from 'app/core/services/backend_srv';
import { mockFolderDTO } from 'app/features/browse-dashboards/fixtures/folder.fixture';

import { dashlistMigrationHandler, type AngularModel } from './migrations';

setBackendSrv(backendSrv);
setupMockServer();

describe('dashlist migrations', () => {
  it('migrates angular panel model to react model', async () => {
    const basePanelModel = wellFormedPanelModel({});
    basePanelModel.pluginVersion = '5.1';

    const angularPanel: PanelModel & AngularModel = {
      ...basePanelModel,
      // pluginVersion: '5.1',
      starred: true,
      recent: true,
      search: true,
      headings: true,
      limit: 7,
      query: 'hello, query',
    };

    const newOptions = await dashlistMigrationHandler(angularPanel);
    expect(newOptions).toEqual({
      showStarred: true,
      showRecentlyViewed: true,
      showSearch: true,
      showHeadings: true,
      maxItems: 7,
      query: 'hello, query',
      includeVars: undefined,
      keepTime: undefined,
    });
    expect(angularPanel).toStrictEqual(basePanelModel);
  });

  it('migrates folder id to folder UID', async () => {
    const folderDTO = mockFolderDTO(1, {
      id: 77,
      uid: 'abc-124',
    });
    server.use(http.get('/api/folders/id/77', () => HttpResponse.json(folderDTO)));

    const basePanelOptions = {
      showStarred: true,
      showRecentlyViewed: true,
      showSearch: true,
      showHeadings: true,
      showFolderNames: true,
      maxItems: 7,
      query: 'hello, query',
      includeVars: false,
      keepTime: false,
      tags: [],
    };
    const panelModel = wellFormedPanelModel({
      ...basePanelOptions,
      folderId: 77,
    });

    const newOptions = await dashlistMigrationHandler(panelModel);

    expect(newOptions).toStrictEqual({
      ...basePanelOptions,
      folderUID: 'abc-124',
    });
  });

  it("doesn't fail if the api request fails", async () => {
    const spyConsoleWarn = jest.spyOn(console, 'warn').mockImplementation();

    server.use(
      http.get('/api/folders/id/:id', () =>
        HttpResponse.json(
          {
            accessErrorId: 'ACE0577385389',
            message: "You'll need additional permissions to perform this action. Permissions needed: folders:read",
            title: 'Access denied',
          },
          { status: 403 }
        )
      )
    );

    const basePanelOptions = {
      showStarred: true,
      showRecentlyViewed: true,
      showSearch: true,
      showHeadings: true,
      showFolderNames: true,
      maxItems: 7,
      query: 'hello, query',
      includeVars: false,
      keepTime: false,
      tags: [],
      folderId: 77,
    };
    const panelModel = wellFormedPanelModel(basePanelOptions);

    // We expect it to not reject
    const newOptions = await dashlistMigrationHandler(panelModel);

    expect(newOptions).toStrictEqual(basePanelOptions);
    expect(spyConsoleWarn).toHaveBeenCalledTimes(1);

    spyConsoleWarn.mockRestore();
  });
});
