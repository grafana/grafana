import { renderHook } from '@testing-library/react-hooks';
import { useUniqueId } from './useUniqueId';
describe('useUniqueId', function () {
    it('should work correctly', function () {
        var _a = renderHook(function () { return useUniqueId(); }), resultA = _a.result, rerenderA = _a.rerender;
        var _b = renderHook(function () { return useUniqueId(); }), resultB = _b.result, rerenderB = _b.rerender;
        // the values of the separate hooks should be different
        expect(resultA.current).not.toBe(resultB.current);
        // we copy the current values after the first render
        var firstValueA = resultA.current;
        var firstValueB = resultB.current;
        rerenderA();
        rerenderB();
        // we check that the value did not change
        expect(resultA.current).toBe(firstValueA);
        expect(resultB.current).toBe(firstValueB);
    });
});
//# sourceMappingURL=useUniqueId.test.js.map