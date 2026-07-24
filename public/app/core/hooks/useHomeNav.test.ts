import { act, getWrapper, renderHook } from 'test/test-utils';

import { setTestFlags } from '@grafana/test-utils/unstable';
import { configureStore } from 'app/store/configureStore';

import { SETUP_GUIDE_HOME_URL, useHomeNav } from './useHomeNav';

const renderUseHomeNav = (url: string) => {
  const store = configureStore({
    navIndex: { home: { id: 'home', text: 'Home', url } },
  });
  return renderHook(() => useHomeNav(), { wrapper: getWrapper({ store, renderWithRouter: false }) });
};

describe('useHomeNav', () => {
  afterEach(async () => {
    // Wrap in act() because setTestFlags fires OpenFeature events that can trigger React state
    // updates while the component is still mounted (RTL cleanup runs in a separate afterEach).
    await act(async () => {
      setTestFlags({});
    });
  });

  it('flag off → returns the setup guide url unchanged', () => {
    setTestFlags({ 'grafana.unifiedHomepage': false });

    const { result } = renderUseHomeNav(SETUP_GUIDE_HOME_URL);

    expect(result.current?.url).toBe(SETUP_GUIDE_HOME_URL);
  });

  it('flag on + setup guide url → rewrites the url to the homepage', () => {
    setTestFlags({ 'grafana.unifiedHomepage': true });

    const { result } = renderUseHomeNav(SETUP_GUIDE_HOME_URL);

    expect(result.current?.url).toBe('/');
  });

  it('flag on + other url → returns the url unchanged', () => {
    setTestFlags({ 'grafana.unifiedHomepage': true });

    const { result } = renderUseHomeNav('/d/custom-home');

    expect(result.current?.url).toBe('/d/custom-home');
  });
});
