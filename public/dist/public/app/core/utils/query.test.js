import { getNextRefIdChar } from './query';
function dataQueryHelper(ids) {
    return ids.map(function (letter) {
        return { refId: letter };
    });
}
var singleDataQuery = dataQueryHelper('ABCDE'.split(''));
var outOfOrderDataQuery = dataQueryHelper('ABD'.split(''));
var singleExtendedDataQuery = dataQueryHelper('ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''));
describe('Get next refId char', function () {
    it('should return next char', function () {
        expect(getNextRefIdChar(singleDataQuery)).toEqual('F');
    });
    it('should get first char', function () {
        expect(getNextRefIdChar([])).toEqual('A');
    });
    it('should get the first avaliable character if a query has been deleted out of order', function () {
        expect(getNextRefIdChar(outOfOrderDataQuery)).toEqual('C');
    });
    it('should append a new char and start from AA when Z is reached', function () {
        expect(getNextRefIdChar(singleExtendedDataQuery)).toEqual('AA');
    });
});
//# sourceMappingURL=query.test.js.map