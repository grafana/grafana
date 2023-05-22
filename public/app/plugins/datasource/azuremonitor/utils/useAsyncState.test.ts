import { renderHook } from '@testing-library/react-hooks';

import { useAsyncState } from './useAsyncState';

interface WaitableMock extends jest.Mock {
  waitToBeCalled(): Promise<unknown>;
}

function createWaitableMock() {
  let resolve: Function;

  const mock = jest.fn() as WaitableMock;
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

  it('should return data from an async function', async () => {
    const apiCall = () => Promise.resolve(['a', 'b', 'c']);
    const setError = jest.fn();

    const { result, waitForNextUpdate } = renderHook(() => useAsyncState(apiCall, setError, []));
    await waitForNextUpdate();

    expect(result.current).toEqual(['a', 'b', 'c']);
  });

  it('should report errors through setError', async () => {
    const error = new Error();
    const apiCall = () => Promise.reject(error);
    const setError = createWaitableMock();

    const { result, waitForNextUpdate } = renderHook(() => useAsyncState(apiCall, setError, []));
    await Promise.race([waitForNextUpdate(), setError.waitToBeCalled()]);

    expect(result.current).toEqual([]);
    expect(setError).toHaveBeenCalledWith(MOCKED_RANDOM_VALUE, error);
  });

  it('should clear the error once the request is successful', async () => {
    const apiCall = () => Promise.resolve(['a', 'b', 'c']);
    const setError = createWaitableMock();

    const { waitForNextUpdate } = renderHook(() => useAsyncState(apiCall, setError, []));
    await Promise.race([waitForNextUpdate(), setError.waitToBeCalled()]);

    expect(setError).toHaveBeenCalledWith(MOCKED_RANDOM_VALUE, undefined);
  });
});
