import { getValuesFromQueryParams } from './getValuesFromQueryParams';
describe('getValuesFromQueryParams', () => {
    it('should return empty array if no keys passed', () => {
        expect(getValuesFromQueryParams({}, [])).toEqual({});
    });
    it('should return empty array if key is not on params', () => {
        expect(getValuesFromQueryParams({}, [{ key: 'category' }])).toEqual({});
    });
    it('should use the default transform if none is passed', () => {
        const obj = getValuesFromQueryParams({ category: 'perf', type: 'foo' }, [{ key: 'category' }, { key: 'type' }]);
        expect(obj.category).toEqual(['perf']);
        expect(obj.type).toEqual(['foo']);
    });
    it('should use custom transforms', () => {
        const obj = getValuesFromQueryParams({ hasType: true, valid: true }, [
            { key: 'hasType' },
            { key: 'valid', transform: (param) => !!param },
        ]);
        expect(obj.hasType).toEqual(['true']);
        expect(obj.valid).toEqual(true);
    });
});
//# sourceMappingURL=getValuesFromQueryParams.test.js.map