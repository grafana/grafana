import { toUrlParams } from '../utils/url';
describe('toUrlParams', function () {
    it('should encode object properties as url parameters', function () {
        var url = toUrlParams({
            server: 'backend-01',
            hasSpace: 'has space',
            many: ['1', '2', '3'],
            true: true,
            number: 20,
            isNull: null,
            isUndefined: undefined,
        });
        expect(url).toBe('server=backend-01&hasSpace=has%20space&many=1&many=2&many=3&true&number=20&isNull=&isUndefined=');
    });
});
describe('toUrlParams', function () {
    it('should encode the same way as angularjs', function () {
        var url = toUrlParams({
            server: ':@',
        });
        expect(url).toBe('server=:@');
    });
});
//# sourceMappingURL=url.test.js.map