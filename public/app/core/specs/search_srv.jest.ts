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
          title: 'folder1',
          type: 'dash-folder',
          id: 1,
        },
        {
          title: 'dash with no folder',
          type: 'dash-db',
          id: 2,
        },
        {
          title: 'dash in folder1 1',
          type: 'dash-db',
          id: 3,
          folderId: 1
        },
        {
          title: 'dash in folder1 2',
          type: 'dash-db',
          id: 4,
          folderId: 1
        },
      ]));

      return searchSrv.search({query: ''}).then(res => {
        results = res;
      });
    });

    it("should create sections for each folder and root", () => {
      expect(results).toHaveLength(2);
    });

    it('should place folders first', () => {
      expect(results[0].title).toBe('folder1');
    });

  });

  describe("with query string and dashboards with folders returned", () => {
    let results;

    beforeEach(() => {
      backendSrvMock.search = jest.fn();

      backendSrvMock.search.mockReturnValue(Promise.resolve([
        {
          id: 2,
          title: 'dash with no folder',
          type: 'dash-db',
        },
        {
          id: 3,
          title: 'dash in folder1 1',
          type: 'dash-db',
          folderId: 1,
          folderTitle: 'folder1',
        },
      ]));

      return searchSrv.search({query: 'search'}).then(res => {
        results = res;
      });
    });

    it("should not specify folder ids", () => {
      expect(backendSrvMock.search.mock.calls[0][0].folderIds).toHaveLength(0);
    });

    it('should place all results in a single section', () => {
      expect(results).toHaveLength(1);
      expect(results[0].hideHeader).toBe(true);
    });

  });

  describe("with tags", () => {
    beforeEach(() => {
      backendSrvMock.search = jest.fn();
      backendSrvMock.search.mockReturnValue(Promise.resolve([]));

      return searchSrv.search({tag: ['atag']}).then(() => {});
    });

    it("should send tags query to backend search", () => {
      expect(backendSrvMock.search.mock.calls[0][0].tag).toHaveLength(1);
    });
  });

  describe("with starred", () => {
    beforeEach(() => {
      backendSrvMock.search = jest.fn();
      backendSrvMock.search.mockReturnValue(Promise.resolve([]));

      return searchSrv.search({starred: true}).then(() => {});
    });

    it("should send starred query to backend search", () => {
      expect(backendSrvMock.search.mock.calls[0][0].starred).toEqual(true);
    });
  });

});
