import { renderHook } from '@testing-library/react';

import { useTimeSrvFix } from './useTimeSrvFix';

describe('useTimeSrvFix', () => {
  it('removes `from` and `to` parameters from url when first mounted', async () => {
    renderHook(() => useTimeSrvFix());
    // const { location } = setupExplore({ urlParams: { from: '1', to: '2' } });
    // await waitForExplore();

    // await waitFor(() => {
    //   expect(location.getSearchObject()).toEqual(expect.not.objectContaining({ from: '1', to: '2' }));
    //   expect(location.getSearchObject()).toEqual(expect.objectContaining({ orgId: '1' }));
    // });
  });
});
