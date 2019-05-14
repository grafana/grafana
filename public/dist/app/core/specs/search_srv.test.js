import { SearchSrv } from 'app/core/services/search_srv';
import { BackendSrvMock } from 'test/mocks/backend_srv';
import impressionSrv from 'app/core/services/impression_srv';
import { contextSrv } from 'app/core/services/context_srv';
import { beforeEach } from 'test/lib/common';
jest.mock('app/core/store', function () {
    return {
        getBool: jest.fn(),
        set: jest.fn(),
    };
});
jest.mock('app/core/services/impression_srv', function () {
    return {
        getDashboardOpened: jest.fn,
    };
});
describe('SearchSrv', function () {
    var searchSrv, backendSrvMock;
    beforeEach(function () {
        backendSrvMock = new BackendSrvMock();
        searchSrv = new SearchSrv(backendSrvMock, Promise);
        contextSrv.isSignedIn = true;
        impressionSrv.getDashboardOpened = jest.fn().mockReturnValue([]);
    });
    describe('With recent dashboards', function () {
        var results;
        beforeEach(function () {
            backendSrvMock.search = jest
                .fn()
                .mockReturnValueOnce(Promise.resolve([{ id: 2, title: 'second but first' }, { id: 1, title: 'first but second' }]))
                .mockReturnValue(Promise.resolve([]));
            impressionSrv.getDashboardOpened = jest.fn().mockReturnValue([1, 2]);
            return searchSrv.search({ query: '' }).then(function (res) {
                results = res;
            });
        });
        it('should include recent dashboards section', function () {
            expect(results[0].title).toBe('Recent');
        });
        it('should return order decided by impressions store not api', function () {
            expect(results[0].items[0].title).toBe('first but second');
            expect(results[0].items[1].title).toBe('second but first');
        });
        describe('and 3 recent dashboards removed in backend', function () {
            var results;
            beforeEach(function () {
                backendSrvMock.search = jest
                    .fn()
                    .mockReturnValueOnce(Promise.resolve([{ id: 2, title: 'two' }, { id: 1, title: 'one' }]))
                    .mockReturnValue(Promise.resolve([]));
                impressionSrv.getDashboardOpened = jest.fn().mockReturnValue([4, 5, 1, 2, 3]);
                return searchSrv.search({ query: '' }).then(function (res) {
                    results = res;
                });
            });
            it('should return 2 dashboards', function () {
                expect(results[0].items.length).toBe(2);
                expect(results[0].items[0].id).toBe(1);
                expect(results[0].items[1].id).toBe(2);
            });
        });
    });
    describe('With starred dashboards', function () {
        var results;
        beforeEach(function () {
            backendSrvMock.search = jest.fn().mockReturnValue(Promise.resolve([{ id: 1, title: 'starred' }]));
            return searchSrv.search({ query: '' }).then(function (res) {
                results = res;
            });
        });
        it('should include starred dashboards section', function () {
            expect(results[0].title).toBe('Starred');
            expect(results[0].items.length).toBe(1);
        });
    });
    describe('With starred dashboards and recent', function () {
        var results;
        beforeEach(function () {
            backendSrvMock.search = jest
                .fn()
                .mockReturnValueOnce(Promise.resolve([{ id: 1, title: 'starred and recent', isStarred: true }, { id: 2, title: 'recent' }]))
                .mockReturnValue(Promise.resolve([{ id: 1, title: 'starred and recent' }]));
            impressionSrv.getDashboardOpened = jest.fn().mockReturnValue([1, 2]);
            return searchSrv.search({ query: '' }).then(function (res) {
                results = res;
            });
        });
        it('should not show starred in recent', function () {
            expect(results[1].title).toBe('Recent');
            expect(results[1].items[0].title).toBe('recent');
        });
        it('should show starred', function () {
            expect(results[0].title).toBe('Starred');
            expect(results[0].items[0].title).toBe('starred and recent');
        });
    });
    describe('with no query string and dashboards with folders returned', function () {
        var results;
        beforeEach(function () {
            backendSrvMock.search = jest
                .fn()
                .mockReturnValueOnce(Promise.resolve([]))
                .mockReturnValue(Promise.resolve([
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
                    folderId: 1,
                },
                {
                    title: 'dash in folder1 2',
                    type: 'dash-db',
                    id: 4,
                    folderId: 1,
                },
            ]));
            return searchSrv.search({ query: '' }).then(function (res) {
                results = res;
            });
        });
        it('should create sections for each folder and root', function () {
            expect(results).toHaveLength(2);
        });
        it('should place folders first', function () {
            expect(results[0].title).toBe('folder1');
        });
    });
    describe('with query string and dashboards with folders returned', function () {
        var results;
        beforeEach(function () {
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
                    folderUid: 'uid',
                    folderTitle: 'folder1',
                    folderUrl: '/dashboards/f/uid/folder1',
                },
            ]));
            return searchSrv.search({ query: 'search' }).then(function (res) {
                results = res;
            });
        });
        it('should not specify folder ids', function () {
            expect(backendSrvMock.search.mock.calls[0][0].folderIds).toHaveLength(0);
        });
        it('should group results by folder', function () {
            expect(results).toHaveLength(2);
            expect(results[0].id).toEqual(0);
            expect(results[1].id).toEqual(1);
            expect(results[1].uid).toEqual('uid');
            expect(results[1].title).toEqual('folder1');
            expect(results[1].url).toEqual('/dashboards/f/uid/folder1');
        });
    });
    describe('with tags', function () {
        beforeEach(function () {
            backendSrvMock.search = jest.fn();
            backendSrvMock.search.mockReturnValue(Promise.resolve([]));
            return searchSrv.search({ tag: ['atag'] }).then(function () { });
        });
        it('should send tags query to backend search', function () {
            expect(backendSrvMock.search.mock.calls[0][0].tag).toHaveLength(1);
        });
    });
    describe('with starred', function () {
        beforeEach(function () {
            backendSrvMock.search = jest.fn();
            backendSrvMock.search.mockReturnValue(Promise.resolve([]));
            return searchSrv.search({ starred: true }).then(function () { });
        });
        it('should send starred query to backend search', function () {
            expect(backendSrvMock.search.mock.calls[0][0].starred).toEqual(true);
        });
    });
    describe('when skipping recent dashboards', function () {
        var getRecentDashboardsCalled = false;
        beforeEach(function () {
            backendSrvMock.search = jest.fn();
            backendSrvMock.search.mockReturnValue(Promise.resolve([]));
            searchSrv.getRecentDashboards = function () {
                getRecentDashboardsCalled = true;
            };
            return searchSrv.search({ skipRecent: true }).then(function () { });
        });
        it('should not fetch recent dashboards', function () {
            expect(getRecentDashboardsCalled).toBeFalsy();
        });
    });
    describe('when skipping starred dashboards', function () {
        var getStarredCalled = false;
        beforeEach(function () {
            backendSrvMock.search = jest.fn();
            backendSrvMock.search.mockReturnValue(Promise.resolve([]));
            impressionSrv.getDashboardOpened = jest.fn().mockReturnValue([]);
            searchSrv.getStarred = function () {
                getStarredCalled = true;
            };
            return searchSrv.search({ skipStarred: true }).then(function () { });
        });
        it('should not fetch starred dashboards', function () {
            expect(getStarredCalled).toBeFalsy();
        });
    });
});
//# sourceMappingURL=search_srv.test.js.map