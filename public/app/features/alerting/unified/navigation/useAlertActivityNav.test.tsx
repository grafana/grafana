import { renderHook } from '@testing-library/react';
import { getWrapper } from 'test/test-utils';

import { configureStore } from 'app/store/configureStore';

import { useAlertActivityNav } from './useAlertActivityNav';

describe('useAlertActivityNav', () => {
  const mockNavIndex = {
    'alert-activity': {
      id: 'alert-activity',
      text: 'Alert activity',
      url: '/alerting/alerts',
    },
    'alert-activity-alerts': {
      id: 'alert-activity-alerts',
      text: 'Alerts',
      url: '/alerting/alerts',
    },
    'alert-activity-groups': {
      id: 'alert-activity-groups',
      text: 'Active notifications',
      url: '/alerting/groups',
    },
  };

  const defaultPreloadedState = {
    navIndex: mockNavIndex,
  };

  it('should return navigation with pageNav for Alerts tab', () => {
    const store = configureStore(defaultPreloadedState);
    const wrapper = getWrapper({
      store,
      renderWithRouter: true,
      historyOptions: {
        initialEntries: ['/alerting/alerts'],
      },
    });

    const { result } = renderHook(() => useAlertActivityNav(), { wrapper });

    expect(result.current.navId).toBe('alert-activity');
    expect(result.current.pageNav).toBeDefined();
    // eslint-disable-next-line testing-library/no-node-access
    expect(result.current.pageNav?.children).toBeDefined();
    // The pageNav should represent Alert Activity (not the active tab) for consistent title
    expect(result.current.pageNav?.text).toBe('Alert activity');
  });

  it('should return navigation with pageNav for Active notifications tab', () => {
    const store = configureStore(defaultPreloadedState);
    const wrapper = getWrapper({
      store,
      renderWithRouter: true,
      historyOptions: {
        initialEntries: ['/alerting/groups'],
      },
    });

    const { result } = renderHook(() => useAlertActivityNav(), { wrapper });

    expect(result.current.navId).toBe('alert-activity');
    expect(result.current.pageNav).toBeDefined();
    // eslint-disable-next-line testing-library/no-node-access
    expect(result.current.pageNav?.children).toBeDefined();
    // The pageNav should represent Alert Activity (not the active tab) for consistent title
    expect(result.current.pageNav?.text).toBe('Alert activity');
  });

  it('should set active tab based on current path', () => {
    const store = configureStore(defaultPreloadedState);
    const wrapper = getWrapper({
      store,
      renderWithRouter: true,
      historyOptions: {
        initialEntries: ['/alerting/groups'],
      },
    });

    const { result } = renderHook(() => useAlertActivityNav(), { wrapper });

    // eslint-disable-next-line testing-library/no-node-access
    const activeNotificationsTab = result.current.pageNav?.children?.find((tab) => tab.id === 'alert-activity-groups');
    expect(activeNotificationsTab?.active).toBe(true);

    // eslint-disable-next-line testing-library/no-node-access
    const alertsTab = result.current.pageNav?.children?.find((tab) => tab.id === 'alert-activity-alerts');
    expect(alertsTab?.active).toBe(false);
  });

  it('should filter tabs based on permissions', () => {
    const limitedNavIndex = {
      'alert-activity': mockNavIndex['alert-activity'],
      'alert-activity-alerts': mockNavIndex['alert-activity-alerts'],
      // Missing 'alert-activity-groups' - user doesn't have permission
    };
    const store = configureStore({
      navIndex: limitedNavIndex,
    });
    const wrapper = getWrapper({
      store,
      renderWithRouter: true,
      historyOptions: {
        initialEntries: ['/alerting/alerts'],
      },
    });

    const { result } = renderHook(() => useAlertActivityNav(), { wrapper });

    // eslint-disable-next-line testing-library/no-node-access
    expect(result.current.pageNav?.children?.length).toBe(1);
    // eslint-disable-next-line testing-library/no-node-access
    expect(result.current.pageNav?.children?.[0].id).toBe('alert-activity-alerts');
  });

  it('should return undefined when alert-activity nav is missing', () => {
    const store = configureStore({
      navIndex: {},
    });
    const wrapper = getWrapper({
      store,
      renderWithRouter: true,
      historyOptions: {
        initialEntries: ['/alerting/groups'],
      },
    });

    const { result } = renderHook(() => useAlertActivityNav(), { wrapper });

    expect(result.current.navId).toBeUndefined();
    expect(result.current.pageNav).toBeUndefined();
  });
});
