import { SearchSrv } from 'app/core/services/search_srv';
import { BackendSrvMock } from 'test/mocks/backend_srv';

describe('SearchSrv', () => {
  let searchSrv, backendSrvMock;

  beforeEach(() => {
    backendSrvMock = new BackendSrvMock();
    searchSrv = new SearchSrv(backendSrvMock);
  });

  describe("with no query string and dashboards with folders returned", () => {
    let results;

    beforeEach(() => {
      backendSrvMock.search = jest.fn().mockReturnValue(Promise.resolve([
        {
          title: 'dash with no folder',
        },
        {
          title: 'dash in folder1 1',
          folderId: 1,
          folderTitle: 'folder1'
        },
        {
          title: 'dash in folder1 2',
          folderId: 1,
          folderTitle: 'folder1'
        },
        {
          title: 'dahs in folder2 1',
          folderId: 2,
          folderTitle: 'folder2'
        }
      ]));

      return searchSrv.search({query: ''}).then(res => {
        results = res;
      });
    });

    it("should create sections for each folder and root", () => {
      expect(results).toHaveLength(3);
    });

  });

});
