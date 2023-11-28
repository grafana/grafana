import { __awaiter } from "tslib";
import { backendSrv } from 'app/core/services/backend_srv';
import { DashboardSearchItemType } from '../types';
import { SQLSearcher } from './sql';
const searchMock = jest.spyOn(backendSrv, 'get');
jest.spyOn(backendSrv, 'fetch');
describe('SQLSearcher', () => {
    beforeEach(() => {
        searchMock.mockReset();
        searchMock.mockResolvedValue([]);
    });
    it('should call search api with correct query for general folder', () => __awaiter(void 0, void 0, void 0, function* () {
        const sqlSearcher = new SQLSearcher();
        const query = {
            query: '*',
            kind: ['dashboard'],
            location: 'General',
            sort: 'name_sort',
        };
        yield sqlSearcher.search(query);
        expect(searchMock).toHaveBeenLastCalledWith('/api/search', {
            limit: 1000,
            sort: query.sort,
            tag: undefined,
            type: DashboardSearchItemType.DashDB,
            folderUIDs: ['General'],
        });
    }));
    it('should call search api with correct folder kind when searching for *', () => __awaiter(void 0, void 0, void 0, function* () {
        const sqlSearcher = new SQLSearcher();
        const query = {
            query: '*',
            kind: ['folder'],
            location: 'any',
            sort: 'name_sort',
        };
        yield sqlSearcher.search(query);
        expect(searchMock).toHaveBeenLastCalledWith('/api/search', {
            limit: 1000,
            sort: query.sort,
            tag: undefined,
            type: DashboardSearchItemType.DashFolder,
            folderUIDs: ['any'],
        });
    }));
    it('should call search api with correct folder kind when searching for a specific term', () => __awaiter(void 0, void 0, void 0, function* () {
        const sqlSearcher = new SQLSearcher();
        const query = {
            query: 'test',
            kind: ['folder'],
            location: 'any',
            sort: 'name_sort',
        };
        yield sqlSearcher.search(query);
        expect(searchMock).toHaveBeenLastCalledWith('/api/search', {
            limit: 1000,
            sort: query.sort,
            query: query.query,
            tag: undefined,
            type: DashboardSearchItemType.DashFolder,
            folderUIDs: ['any'],
        });
    }));
    it('should call search api with correct folder kind when searching with a specific uid', () => __awaiter(void 0, void 0, void 0, function* () {
        const sqlSearcher = new SQLSearcher();
        const query = {
            query: 'test',
            kind: ['folder'],
            location: 'any',
            sort: 'name_sort',
            uid: ['T202C0Tnk'],
        };
        yield sqlSearcher.search(query);
        expect(searchMock).toHaveBeenLastCalledWith('/api/search', {
            limit: 1000,
            sort: query.sort,
            query: query.query,
            tag: undefined,
            dashboardUID: query.uid,
            type: DashboardSearchItemType.DashFolder,
        });
    }));
    it('starred should call search api with correct query', () => __awaiter(void 0, void 0, void 0, function* () {
        const sqlSearcher = new SQLSearcher();
        const query = {
            query: 'test',
            location: 'any',
            sort: 'name_sort',
            uid: ['T202C0Tnk'],
            starred: true,
        };
        yield sqlSearcher.starred(query);
        expect(searchMock).toHaveBeenLastCalledWith('/api/search', {
            limit: 1000,
            sort: query.sort,
            query: query.query,
            tag: undefined,
            dashboardUID: query.uid,
            starred: true,
        });
    }));
    describe('pagination', () => {
        it.each([
            { from: undefined, expectedPage: undefined },
            { from: 0, expectedPage: 1 },
            { from: 50, expectedPage: 2 },
            { from: 150, expectedPage: 4 },
        ])('should search page $expectedPage when skipping $from results', ({ from, expectedPage }) => __awaiter(void 0, void 0, void 0, function* () {
            const sqlSearcher = new SQLSearcher();
            yield sqlSearcher.search({
                query: '*',
                kind: ['dashboard'],
                from,
                limit: 50,
            });
            expect(searchMock).toHaveBeenLastCalledWith('/api/search', {
                limit: 50,
                page: expectedPage,
                sort: undefined,
                tag: undefined,
                type: 'dash-db',
            });
        }));
    });
});
//# sourceMappingURL=sql.test.js.map