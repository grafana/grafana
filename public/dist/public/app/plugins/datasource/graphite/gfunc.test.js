import gfunc from './gfunc';
describe('gfunc', function () {
    var INDEX = {
        foo: {
            name: 'foo',
            params: [],
        },
    };
    it('returns function from the index', function () {
        expect(gfunc.getFuncDef('foo', INDEX)).toEqual(INDEX.foo);
    });
    it('marks function as unknown when it is not available in the index', function () {
        expect(gfunc.getFuncDef('bar', INDEX)).toEqual({
            name: 'bar',
            params: [{ name: '', type: '', multiple: true }],
            defaultParams: [''],
            unknown: true,
        });
    });
});
//# sourceMappingURL=gfunc.test.js.map