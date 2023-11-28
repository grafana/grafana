import { getNextRefIdChar, queryIsEmpty } from './query';
function dataQueryHelper(ids) {
    return ids.map((letter) => {
        return { refId: letter };
    });
}
const singleDataQuery = dataQueryHelper('ABCDE'.split(''));
const outOfOrderDataQuery = dataQueryHelper('ABD'.split(''));
const singleExtendedDataQuery = dataQueryHelper('ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''));
describe('Get next refId char', () => {
    it('should return next char', () => {
        expect(getNextRefIdChar(singleDataQuery)).toEqual('F');
    });
    it('should get first char', () => {
        expect(getNextRefIdChar([])).toEqual('A');
    });
    it('should get the first available character if a query has been deleted out of order', () => {
        expect(getNextRefIdChar(outOfOrderDataQuery)).toEqual('C');
    });
    it('should append a new char and start from AA when Z is reached', () => {
        expect(getNextRefIdChar(singleExtendedDataQuery)).toEqual('AA');
    });
});
describe('queryIsEmpty', () => {
    it('should return true if query only includes props that are defined in the DataQuery interface', () => {
        const testQuery = { refId: 'A' };
        expect(queryIsEmpty(testQuery)).toEqual(true);
    });
    it('should return true if query only includes props that are defined in the DataQuery interface and a label prop', () => {
        const testQuery = { refId: 'A', label: '' };
        expect(queryIsEmpty(testQuery)).toEqual(true);
    });
    it('should return false if query only includes props that are not defined in the DataQuery interface', () => {
        const testQuery = { refId: 'A', name: 'test' };
        expect(queryIsEmpty(testQuery)).toEqual(false);
    });
});
//# sourceMappingURL=query.test.js.map