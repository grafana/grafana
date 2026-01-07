import { renderHook } from '@testing-library/react';
import { getWrapper } from 'test/test-utils';

import { config } from '@grafana/runtime';

import { useNotificationConfigNav } from './useNotificationConfigNav';

describe('useNotificationConfigNav', () => {
  const mockNavIndex = {
    'notification-config': {
      id: 'notification-config',
      text: 'Notification configuration',
      url: '/alerting/notifications',
    },
    'notification-config-contact-points': {
      id: 'notification-config-contact-points',
      text: 'Contact points',
      url: '/alerting/notifications',
    },
    'notification-config-policies': {
      id: 'notification-config-policies',
      text: 'Notification policies',
      url: '/alerting/routes',
    },
    'notification-config-templates': {
      id: 'notification-config-templates',
      text: 'Notification templates',
      url: '/alerting/notifications/templates',
    },
    'notification-config-time-intervals': {
      id: 'notification-config-time-intervals',
      text: 'Time intervals',
      url: '/alerting/routes?tab=time_intervals',
    },
    receivers: {
      id: 'receivers',
      text: 'Contact points',
      url: '/alerting/notifications',
    },
    'am-routes': {
      id: 'am-routes',
      text: 'Notification policies',
      url: '/alerting/routes',
    },
  };

  const defaultPreloadedState = {
    navIndex: mockNavIndex,
  };

  beforeEach(() => {
    config.featureToggles.alertingNavigationV2 = false;
  });

  it('should return legacy navId when feature flag is off', () => {
    const wrapper = getWrapper({
      preloadedState: defaultPreloadedState,
      renderWithRouter: true,
      historyOptions: {
        initialEntries: ['/alerting/notifications'],
      },
    });

    const { result } = renderHook(() => useNotificationConfigNav(), { wrapper });

    expect(result.current.navId).toBe('receivers');
    expect(result.current.pageNav).toBeUndefined();
  });

  it('should return V2 navigation when feature flag is on', () => {
    config.featureToggles.alertingNavigationV2 = true;
    const wrapper = getWrapper({
      preloadedState: defaultPreloadedState,
      renderWithRouter: true,
      historyOptions: {
        initialEntries: ['/alerting/notifications'],
      },
    });

    const { result } = renderHook(() => useNotificationConfigNav(), { wrapper });

    expect(result.current.navId).toBe('notification-config');
    expect(result.current.pageNav).toBeDefined();
    // eslint-disable-next-line testing-library/no-node-access
    expect(result.current.pageNav?.children).toBeDefined();
  });

  it('should detect time intervals tab from query params', () => {
    config.featureToggles.alertingNavigationV2 = true;
    const wrapper = getWrapper({
      preloadedState: defaultPreloadedState,
      renderWithRouter: true,
      historyOptions: {
        initialEntries: ['/alerting/routes?tab=time_intervals'],
      },
    });

    const { result } = renderHook(() => useNotificationConfigNav(), { wrapper });

    // eslint-disable-next-line testing-library/no-node-access
    const timeIntervalsTab = result.current.pageNav?.children?.find(
      (tab) => tab.id === 'notification-config-time-intervals'
    );
    expect(timeIntervalsTab?.active).toBe(true);
  });

  it('should filter tabs based on permissions', () => {
    config.featureToggles.alertingNavigationV2 = true;
    const limitedNavIndex = {
      'notification-config': mockNavIndex['notification-config'],
      'notification-config-contact-points': mockNavIndex['notification-config-contact-points'],
      // Missing other tabs - user doesn't have permission
    };
    const wrapper = getWrapper({
      preloadedState: {
        navIndex: limitedNavIndex,
      },
      renderWithRouter: true,
      historyOptions: {
        initialEntries: ['/alerting/notifications'],
      },
    });

    const { result } = renderHook(() => useNotificationConfigNav(), { wrapper });

    // eslint-disable-next-line testing-library/no-node-access
    expect(result.current.pageNav?.children?.length).toBe(1);
    // eslint-disable-next-line testing-library/no-node-access
    expect(result.current.pageNav?.children?.[0].id).toBe('notification-config-contact-points');
  });
});
