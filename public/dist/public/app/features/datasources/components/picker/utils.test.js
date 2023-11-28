import { isDataSourceMatch, getDataSourceCompareFn, matchDataSourceWithSearch } from './utils';
describe('isDataSourceMatch', () => {
    const dataSourceInstanceSettings = { uid: 'a' };
    it('matches a string with the uid', () => {
        expect(isDataSourceMatch(dataSourceInstanceSettings, 'a')).toBeTruthy();
    });
    it('matches a datasource with a datasource by the uid', () => {
        expect(isDataSourceMatch(dataSourceInstanceSettings, { uid: 'a' })).toBeTruthy();
    });
    it('matches a datasource ref with a datasource by the uid', () => {
        expect(isDataSourceMatch(dataSourceInstanceSettings, { uid: 'a' })).toBeTruthy();
    });
    it('doesnt match with null', () => {
        expect(isDataSourceMatch(dataSourceInstanceSettings, null)).toBeFalsy();
    });
    it('doesnt match a datasource to a non matching string', () => {
        expect(isDataSourceMatch(dataSourceInstanceSettings, 'b')).toBeFalsy();
    });
    it('doesnt match a datasource with a different datasource uid', () => {
        expect(isDataSourceMatch(dataSourceInstanceSettings, { uid: 'b' })).toBeFalsy();
    });
    it('doesnt match a datasource with a datasource ref with a different uid', () => {
        expect(isDataSourceMatch(dataSourceInstanceSettings, { uid: 'b' })).toBeFalsy();
    });
});
describe('getDataSouceCompareFn', () => {
    const dataSources = [
        { uid: 'c', name: 'c', meta: { builtIn: false } },
        { uid: 'D', name: 'D', meta: { builtIn: false } },
        { uid: 'a', name: 'a', meta: { builtIn: true } },
        { uid: 'b', name: 'b', meta: { builtIn: false } },
    ];
    it('sorts data sources alphabetically ignoring captitalization', () => {
        dataSources.sort(getDataSourceCompareFn(undefined, [], []));
        expect(dataSources).toEqual([
            { uid: 'b', name: 'b', meta: { builtIn: false } },
            { uid: 'c', name: 'c', meta: { builtIn: false } },
            { uid: 'D', name: 'D', meta: { builtIn: false } },
            { uid: 'a', name: 'a', meta: { builtIn: true } },
        ]);
    });
    it('sorts built in datasources last and other data sources alphabetically', () => {
        dataSources.sort(getDataSourceCompareFn(undefined, [], []));
        expect(dataSources).toEqual([
            { uid: 'b', name: 'b', meta: { builtIn: false } },
            { uid: 'c', name: 'c', meta: { builtIn: false } },
            { uid: 'D', name: 'D', meta: { builtIn: false } },
            { uid: 'a', name: 'a', meta: { builtIn: true } },
        ]);
    });
    it('sorts the current datasource before others', () => {
        dataSources.sort(getDataSourceCompareFn('c', [], []));
        expect(dataSources).toEqual([
            { uid: 'c', name: 'c', meta: { builtIn: false } },
            { uid: 'b', name: 'b', meta: { builtIn: false } },
            { uid: 'D', name: 'D', meta: { builtIn: false } },
            { uid: 'a', name: 'a', meta: { builtIn: true } },
        ]);
    });
    it('sorts recently used datasources first', () => {
        dataSources.sort(getDataSourceCompareFn(undefined, ['c', 'a'], []));
        expect(dataSources).toEqual([
            { uid: 'a', name: 'a', meta: { builtIn: true } },
            { uid: 'c', name: 'c', meta: { builtIn: false } },
            { uid: 'b', name: 'b', meta: { builtIn: false } },
            { uid: 'D', name: 'D', meta: { builtIn: false } },
        ]);
    });
    it('sorts variables before other datasources', () => {
        dataSources.sort(getDataSourceCompareFn(undefined, [], ['c', 'b']));
        expect(dataSources).toEqual([
            { uid: 'b', name: 'b', meta: { builtIn: false } },
            { uid: 'c', name: 'c', meta: { builtIn: false } },
            { uid: 'D', name: 'D', meta: { builtIn: false } },
            { uid: 'a', name: 'a', meta: { builtIn: true } },
        ]);
    });
    it('sorts datasources current -> recently used -> variables -> others -> built in', () => {
        const dataSources = [
            { uid: 'a', name: 'a', meta: { builtIn: true } },
            { uid: 'b', name: 'b', meta: { builtIn: false } },
            { uid: 'c', name: 'c', meta: { builtIn: false } },
            { uid: 'e', name: 'e', meta: { builtIn: false } },
            { uid: 'D', name: 'D', meta: { builtIn: false } },
            { uid: 'f', name: 'f', meta: { builtIn: false } },
        ];
        dataSources.sort(getDataSourceCompareFn('c', ['b', 'e'], ['d']));
        expect(dataSources).toEqual([
            { uid: 'c', name: 'c', meta: { builtIn: false } },
            { uid: 'e', name: 'e', meta: { builtIn: false } },
            { uid: 'b', name: 'b', meta: { builtIn: false } },
            { uid: 'D', name: 'D', meta: { builtIn: false } },
            { uid: 'f', name: 'f', meta: { builtIn: false } },
            { uid: 'a', name: 'a', meta: { builtIn: true } },
        ]);
    });
});
describe('matchDataSourceWithSearch', () => {
    let dataSource;
    beforeEach(() => {
        dataSource = {
            name: 'My SQL DB',
        };
    });
    it('should return true when the search term matches the data source name', () => {
        const searchTerm = 'My SQL';
        expect(matchDataSourceWithSearch(dataSource, searchTerm)).toBe(true);
    });
    it('should return true when the search term matches part of the data source name', () => {
        const searchTerm = 'SQL';
        expect(matchDataSourceWithSearch(dataSource, searchTerm)).toBe(true);
    });
    it('should return false when the search term does not match the data source name', () => {
        const searchTerm = 'Oracle';
        expect(matchDataSourceWithSearch(dataSource, searchTerm)).toBe(false);
    });
    it('should return true when the search term is empty', () => {
        const searchTerm = '';
        expect(matchDataSourceWithSearch(dataSource, searchTerm)).toBe(true);
    });
    it('should ignore case when matching the search term', () => {
        dataSource.name = 'PostgreSQL DB';
        const searchTerm = 'postgre';
        expect(matchDataSourceWithSearch(dataSource, searchTerm)).toBe(true);
    });
});
//# sourceMappingURL=utils.test.js.map