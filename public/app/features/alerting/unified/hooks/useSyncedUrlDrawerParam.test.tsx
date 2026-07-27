import { act, renderHook } from 'test/test-utils';

import { useSyncedUrlDrawerParam } from './useSyncedUrlDrawerParam';
import { useURLSearchParams } from './useURLSearchParams';

jest.mock('./useURLSearchParams', () => ({
  useURLSearchParams: jest.fn(),
}));

const useURLSearchParamsMock = useURLSearchParams as jest.MockedFunction<typeof useURLSearchParams>;
const setSearchParamsMock = jest.fn();

describe('useSyncedUrlDrawerParam', () => {
  beforeEach(() => {
    setSearchParamsMock.mockReset();
  });

  it('reads the param from the current search string', () => {
    useURLSearchParamsMock.mockReturnValue([new URLSearchParams('?enrichment=foo'), setSearchParamsMock]);
    const { result } = renderHook(() => useSyncedUrlDrawerParam('enrichment'));

    expect(result.current.value).toBe('foo');
  });

  it('returns null when the param is absent', () => {
    useURLSearchParamsMock.mockReturnValue([new URLSearchParams(''), setSearchParamsMock]);
    const { result } = renderHook(() => useSyncedUrlDrawerParam('enrichment'));

    expect(result.current.value).toBeNull();
  });

  it('clears the param when setValue is called with null', async () => {
    useURLSearchParamsMock.mockReturnValue([new URLSearchParams('?enrichment=bar'), setSearchParamsMock]);
    const { result } = renderHook(() => useSyncedUrlDrawerParam('enrichment'));

    await act(async () => {
      result.current.setValue(null, true);
    });

    expect(setSearchParamsMock).toHaveBeenCalledWith({ enrichment: undefined }, true);
  });
});
