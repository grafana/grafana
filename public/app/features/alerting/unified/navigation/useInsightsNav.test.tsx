import { renderHook } from '@testing-library/react';
import { getWrapper } from 'test/test-utils';

import { configureStore } from 'app/store/configureStore';

import { useInsightsNav } from './useInsightsNav';

describe('useInsightsNav', () => {
  const mockNavIndex = {
    insights: {
      id: 'insights',
      text: 'Insights',
      url: '/alerting/insights',
    },
    'insights-system': {
      id: 'insights-system',
      text: 'System Insights',
      url: '/alerting/insights',
    },
    'insights-history': {
      id: 'insights-history',
      text: 'Alert state history',
      url: '/alerting/history',
    },
  };

  const defaultPreloadedState = {
    navIndex: mockNavIndex,
  };

  it('should return navigation with pageNav', () => {
    const store = configureStore(defaultPreloadedState);
    const wrapper = getWrapper({
      store,
      renderWithRouter: true,
      historyOptions: {
        initialEntries: ['/alerting/insights'],
      },
    });

    const { result } = renderHook(() => useInsightsNav(), { wrapper });

    expect(result.current.navId).toBe('insights');
    expect(result.current.pageNav).toBeDefined();
    // eslint-disable-next-line testing-library/no-node-access
    expect(result.current.pageNav?.children).toBeDefined();
  });

  it('should set active tab based on current path', () => {
    const store = configureStore(defaultPreloadedState);
    const wrapper = getWrapper({
      store,
      renderWithRouter: true,
      historyOptions: {
        initialEntries: ['/alerting/history'],
      },
    });

    const { result } = renderHook(() => useInsightsNav(), { wrapper });

    // eslint-disable-next-line testing-library/no-node-access
    const historyTab = result.current.pageNav?.children?.find((tab) => tab.id === 'insights-history');
    expect(historyTab?.active).toBe(true);
  });

  it('should filter tabs based on permissions', () => {
    const limitedNavIndex = {
      insights: mockNavIndex.insights,
      'insights-system': mockNavIndex['insights-system'],
      // Missing 'insights-history' - user doesn't have permission
    };
    const store = configureStore({
      navIndex: limitedNavIndex,
    });
    const wrapper = getWrapper({
      store,
      renderWithRouter: true,
      historyOptions: {
        initialEntries: ['/alerting/insights'],
      },
    });

    const { result } = renderHook(() => useInsightsNav(), { wrapper });

    // eslint-disable-next-line testing-library/no-node-access
    expect(result.current.pageNav?.children?.length).toBe(1);
    // eslint-disable-next-line testing-library/no-node-access
    expect(result.current.pageNav?.children?.[0].id).toBe('insights-system');
  });
});
