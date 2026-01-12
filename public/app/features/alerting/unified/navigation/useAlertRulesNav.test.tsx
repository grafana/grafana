import { renderHook } from '@testing-library/react';
import { getWrapper } from 'test/test-utils';

import { configureStore } from 'app/store/configureStore';

import { useAlertRulesNav } from './useAlertRulesNav';

describe('useAlertRulesNav', () => {
  const mockNavIndex = {
    'alert-rules': {
      id: 'alert-rules',
      text: 'Alert rules',
      url: '/alerting/list',
      icon: 'list-ul',
    },
    'alert-rules-list': {
      id: 'alert-rules-list',
      text: 'Alert rules',
      url: '/alerting/list',
    },
    'alert-rules-recently-deleted': {
      id: 'alert-rules-recently-deleted',
      text: 'Recently deleted',
      url: '/alerting/recently-deleted',
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
        initialEntries: ['/alerting/list'],
      },
    });

    const { result } = renderHook(() => useAlertRulesNav(), { wrapper });

    expect(result.current.navId).toBe('alert-rules');
    expect(result.current.pageNav).toBeDefined();
    // eslint-disable-next-line testing-library/no-node-access
    expect(result.current.pageNav?.children).toBeDefined();
    // eslint-disable-next-line testing-library/no-node-access
    expect(result.current.pageNav?.children?.length).toBeGreaterThan(0);
  });

  it('should filter tabs based on permissions', () => {
    const limitedNavIndex = {
      'alert-rules': mockNavIndex['alert-rules'],
      'alert-rules-list': mockNavIndex['alert-rules-list'],
      // Missing 'alert-rules-recently-deleted' - user doesn't have permission
    };
    const store = configureStore({
      navIndex: limitedNavIndex,
    });
    const wrapper = getWrapper({
      store,
      renderWithRouter: true,
      historyOptions: {
        initialEntries: ['/alerting/list'],
      },
    });

    const { result } = renderHook(() => useAlertRulesNav(), { wrapper });

    // eslint-disable-next-line testing-library/no-node-access
    expect(result.current.pageNav?.children?.length).toBe(1);
    // eslint-disable-next-line testing-library/no-node-access
    expect(result.current.pageNav?.children?.[0].id).toBe('alert-rules-list');
  });

  it('should set active tab based on current path', () => {
    const store = configureStore(defaultPreloadedState);
    const wrapper = getWrapper({
      store,
      renderWithRouter: true,
      historyOptions: {
        initialEntries: ['/alerting/recently-deleted'],
      },
    });

    const { result } = renderHook(() => useAlertRulesNav(), { wrapper });

    // eslint-disable-next-line testing-library/no-node-access
    const recentlyDeletedTab = result.current.pageNav?.children?.find(
      (tab) => tab.id === 'alert-rules-recently-deleted'
    );
    expect(recentlyDeletedTab?.active).toBe(true);
  });
});
