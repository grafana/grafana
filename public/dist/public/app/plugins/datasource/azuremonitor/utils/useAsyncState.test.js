import { __awaiter } from "tslib";
import { renderHook, waitFor } from '@testing-library/react';
import { useAsyncState } from './useAsyncState';
function createWaitableMock() {
    let resolve;
    const mock = jest.fn();
    mock.mockImplementation(() => {
        resolve && resolve();
    });
    mock.waitToBeCalled = () => {
        return new Promise((_resolve) => (resolve = _resolve));
    };
    return mock;
}
describe('useAsyncState', () => {
    const MOCKED_RANDOM_VALUE = 0.42069;
    beforeEach(() => {
        jest.spyOn(global.Math, 'random').mockReturnValue(MOCKED_RANDOM_VALUE);
    });
    afterEach(() => {
        jest.spyOn(global.Math, 'random').mockRestore();
    });
    it('should return data from an async function', () => __awaiter(void 0, void 0, void 0, function* () {
        const apiCall = () => Promise.resolve(['a', 'b', 'c']);
        const setError = jest.fn();
        const { result } = renderHook(() => useAsyncState(apiCall, setError, []));
        yield waitFor(() => {
            expect(result.current).toEqual(['a', 'b', 'c']);
        });
    }));
    it('should report errors through setError', () => __awaiter(void 0, void 0, void 0, function* () {
        const error = new Error();
        const apiCall = () => Promise.reject(error);
        const setError = createWaitableMock();
        const { result } = renderHook(() => useAsyncState(apiCall, setError, []));
        yield waitFor(() => {
            expect(result.current).toEqual([]);
            expect(setError).toHaveBeenCalledWith(MOCKED_RANDOM_VALUE, error);
        });
    }));
    it('should clear the error once the request is successful', () => __awaiter(void 0, void 0, void 0, function* () {
        const apiCall = () => Promise.resolve(['a', 'b', 'c']);
        const setError = createWaitableMock();
        renderHook(() => useAsyncState(apiCall, setError, []));
        yield waitFor(() => {
            expect(setError).toHaveBeenCalledWith(MOCKED_RANDOM_VALUE, undefined);
        });
    }));
});
//# sourceMappingURL=useAsyncState.test.js.map