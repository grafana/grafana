import { parseQuery } from './query_utils';
describe('parseQuery', function () {
    it('returns empty for empty string', function () {
        expect(parseQuery('')).toEqual({
            query: '',
            regexp: '',
        });
    });
    it('returns regexp for strings without query', function () {
        expect(parseQuery('test')).toEqual({
            query: '',
            regexp: 'test',
        });
    });
    it('returns query for strings without regexp', function () {
        expect(parseQuery('{foo="bar"}')).toEqual({
            query: '{foo="bar"}',
            regexp: '',
        });
    });
    it('returns query for strings with query and search string', function () {
        expect(parseQuery('x {foo="bar"}')).toEqual({
            query: '{foo="bar"}',
            regexp: 'x',
        });
    });
    it('returns query for strings with query and regexp', function () {
        expect(parseQuery('{foo="bar"} x|y')).toEqual({
            query: '{foo="bar"}',
            regexp: 'x|y',
        });
    });
    it('returns query for selector with two labels', function () {
        expect(parseQuery('{foo="bar", baz="42"}')).toEqual({
            query: '{foo="bar", baz="42"}',
            regexp: '',
        });
    });
    it('returns query and regexp with quantifiers', function () {
        expect(parseQuery('{foo="bar"} \\.java:[0-9]{1,5}')).toEqual({
            query: '{foo="bar"}',
            regexp: '\\.java:[0-9]{1,5}',
        });
        expect(parseQuery('\\.java:[0-9]{1,5} {foo="bar"}')).toEqual({
            query: '{foo="bar"}',
            regexp: '\\.java:[0-9]{1,5}',
        });
    });
});
//# sourceMappingURL=query_utils.test.js.map