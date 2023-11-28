import { __awaiter } from "tslib";
import { DataFrameView, FieldType } from '@grafana/data';
import { getGrafanaSearcher } from 'app/features/search/service';
import { listDashboards } from './services';
describe('browse-dashboards services', () => {
    describe('listDashboards', () => {
        const searchData = {
            fields: [
                { name: 'kind', type: FieldType.string, config: {}, values: [] },
                { name: 'name', type: FieldType.string, config: {}, values: [] },
                { name: 'uid', type: FieldType.string, config: {}, values: [] },
                { name: 'url', type: FieldType.string, config: {}, values: [] },
                { name: 'tags', type: FieldType.other, config: {}, values: [] },
                { name: 'location', type: FieldType.string, config: {}, values: [] },
            ],
            length: 0,
        };
        const mockSearchResult = {
            isItemLoaded: jest.fn(),
            loadMoreItems: jest.fn(),
            totalRows: searchData.length,
            view: new DataFrameView(searchData),
        };
        const searchMock = jest.spyOn(getGrafanaSearcher(), 'search');
        searchMock.mockResolvedValue(mockSearchResult);
        const PAGE_SIZE = 50;
        it.each([
            { page: undefined, expectedFrom: 0 },
            { page: 1, expectedFrom: 0 },
            { page: 2, expectedFrom: 50 },
            { page: 4, expectedFrom: 150 },
        ])('skips first $expectedFrom when listing page $page', ({ page, expectedFrom }) => __awaiter(void 0, void 0, void 0, function* () {
            yield listDashboards('abc-123', page, PAGE_SIZE);
            expect(searchMock).toHaveBeenCalledWith({
                kind: ['dashboard'],
                query: '*',
                location: 'abc-123',
                from: expectedFrom,
                limit: PAGE_SIZE,
            });
        }));
    });
});
//# sourceMappingURL=services.test.js.map