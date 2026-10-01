import { getWrapper, renderHook } from 'test/test-utils';

import { configureStore } from 'app/store/configureStore';

import { useHomeNav } from './useHomeNav';

const renderUseHomeNav = (url: string) => {
  const store = configureStore({
    navIndex: { other: { id: 'other', text: 'other', url: '/a/other-app' }, home: { id: 'home', text: 'Home', url } },
  });
  return renderHook(() => useHomeNav(), { wrapper: getWrapper({ store, renderWithRouter: false }) });
};

describe('useHomeNav', () => {
  it('returns the home url unchanged', () => {
    const { result } = renderUseHomeNav('/d/custom-home');
    expect(result.current?.url).toBe('/d/custom-home');
  });
});
