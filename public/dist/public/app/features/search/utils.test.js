import { parseRouteParams } from './utils';
describe('Search utils', () => {
    describe('parseRouteParams', () => {
        it('should remove all undefined keys', () => {
            const params = { sort: undefined, tag: undefined, query: 'test' };
            expect(parseRouteParams(params)).toEqual({
                query: 'test',
            });
        });
        it('should return tag as array, if present', () => {
            const params = { sort: undefined, tag: 'test', query: 'test' };
            expect(parseRouteParams(params)).toEqual({
                query: 'test',
                tag: ['test'],
            });
            const params2 = { sort: undefined, tag: ['test'], query: 'test' };
            expect(parseRouteParams(params2)).toEqual({
                query: 'test',
                tag: ['test'],
            });
        });
        it('should prepend folder:{folder} to the query if folder is present', () => {
            expect(parseRouteParams({ folder: 'current' })).toEqual({
                folder: 'current',
                query: 'folder:current ',
            });
            // Prepend to exiting query
            const params = { query: 'test', folder: 'current' };
            expect(parseRouteParams(params)).toEqual({
                folder: 'current',
                query: 'folder:current test',
            });
        });
    });
});
//# sourceMappingURL=utils.test.js.map