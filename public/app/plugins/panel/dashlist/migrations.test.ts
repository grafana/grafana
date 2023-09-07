import { wellFormedPanelModel } from 'test/fixtures/panelModel.fixture';

import { PanelModel } from '@grafana/data';
import { mockFolderDTO } from 'app/features/browse-dashboards/fixtures/folder.fixture';

import { dashlistMigrationHandler, AngularModel } from './migrations';

const getMock = jest.fn();

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: () => ({
    get: getMock,
  }),
}));

describe('dashlist migrations', () => {
  it('migrates angular panel model to react model', async () => {
    const basePanelModel = wellFormedPanelModel({});
    basePanelModel.pluginVersion = '5.1';

    const angularPanel: PanelModel<any> & AngularModel = {
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
    getMock.mockResolvedValue(folderDTO);

    const basePanelOptions = {
      showStarred: true,
      showRecentlyViewed: true,
      showSearch: true,
      showHeadings: true,
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
});
