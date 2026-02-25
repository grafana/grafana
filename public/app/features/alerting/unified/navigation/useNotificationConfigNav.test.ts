import { renderHook } from '@testing-library/react';
import { useLocation } from 'react-router-dom-v5-compat';

import { config } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

import {
  getNotificationConfigNavId,
  useContactPointsNav,
  useNotificationConfigNav,
  useNotificationPoliciesNav,
  useTemplatesNav,
  useTimeIntervalsNav,
} from './useNotificationConfigNav';

// Mock dependencies
jest.mock('react-router-dom-v5-compat', () => ({
  useLocation: jest.fn(),
}));

const mockUseLocation = jest.mocked(useLocation);

function mockLocation(pathname: string) {
  mockUseLocation.mockReturnValue({ pathname, search: '', hash: '', state: null, key: 'default' });
}

jest.mock('app/types/store', () => ({
  useSelector: jest.fn((selector) =>
    selector({
      navIndex: {
        'notification-config': {
          id: 'notification-config',
          text: 'Notification configuration',
          url: '/alerting/notifications',
        },
      },
    })
  ),
}));

jest.mock('app/core/services/context_srv', () => ({
  contextSrv: {
    hasPermission: jest.fn(),
  },
}));

const mockHasPermission = contextSrv.hasPermission as jest.Mock;

describe('useNotificationConfigNav', () => {
  const originalFeatureToggles = config.featureToggles;

  beforeEach(() => {
    jest.clearAllMocks();
    mockLocation('/alerting/notifications');
  });

  afterEach(() => {
    config.featureToggles = originalFeatureToggles;
  });

  describe('when alertingNavigationV2 is enabled', () => {
    beforeEach(() => {
      config.featureToggles = { ...originalFeatureToggles, alertingNavigationV2: true };
    });

    it('should return navId notification-config', () => {
      mockHasPermission.mockReturnValue(true);

      const { result } = renderHook(() => useNotificationConfigNav());

      expect(result.current.navId).toBe('notification-config');
    });

    it('should return pageNav with tabs when user has all permissions', () => {
      mockHasPermission.mockReturnValue(true);

      const { result } = renderHook(() => useNotificationConfigNav());

      expect(result.current.pageNav).toBeDefined();
      // Note: children here refers to NavModelItem.children (tab items), not DOM children
      // eslint-disable-next-line testing-library/no-node-access
      expect(result.current.pageNav?.children).toHaveLength(4);
      // eslint-disable-next-line testing-library/no-node-access
      expect(result.current.pageNav?.children?.[0].id).toBe('notification-config-contact-points');
      // eslint-disable-next-line testing-library/no-node-access
      expect(result.current.pageNav?.children?.[1].id).toBe('notification-config-policies');
      // eslint-disable-next-line testing-library/no-node-access
      expect(result.current.pageNav?.children?.[2].id).toBe('notification-config-templates');
      // eslint-disable-next-line testing-library/no-node-access
      expect(result.current.pageNav?.children?.[3].id).toBe('notification-config-time-intervals');
    });

    it('should filter tabs based on permissions', () => {
      // Only allow contact points and templates
      mockHasPermission.mockImplementation((action: AccessControlAction) => {
        return (
          action === AccessControlAction.AlertingReceiversRead || action === AccessControlAction.AlertingTemplatesRead
        );
      });

      const { result } = renderHook(() => useNotificationConfigNav());

      // eslint-disable-next-line testing-library/no-node-access
      expect(result.current.pageNav?.children).toHaveLength(2);
      // eslint-disable-next-line testing-library/no-node-access
      expect(result.current.pageNav?.children?.[0].id).toBe('notification-config-contact-points');
      // eslint-disable-next-line testing-library/no-node-access
      expect(result.current.pageNav?.children?.[1].id).toBe('notification-config-templates');
    });

    it('should only mark the time intervals tab as active when on time intervals path', () => {
      mockHasPermission.mockReturnValue(true);
      mockLocation('/alerting/routes/mute-timing');

      const { result } = renderHook(() => useNotificationConfigNav());

      // eslint-disable-next-line testing-library/no-node-access
      const tabs = result.current.pageNav?.children;
      const activeTabs = tabs?.filter((tab) => tab.active);

      expect(activeTabs).toHaveLength(1);
      expect(activeTabs?.[0].id).toBe('notification-config-time-intervals');
    });

    it('should only mark the notification policies tab as active when on routes path', () => {
      mockHasPermission.mockReturnValue(true);
      mockLocation('/alerting/routes');

      const { result } = renderHook(() => useNotificationConfigNav());

      // eslint-disable-next-line testing-library/no-node-access
      const tabs = result.current.pageNav?.children;
      const activeTabs = tabs?.filter((tab) => tab.active);

      expect(activeTabs).toHaveLength(1);
      expect(activeTabs?.[0].id).toBe('notification-config-policies');
    });

    it('should not show tabs bar when only one tab is visible', () => {
      // Only allow contact points
      mockHasPermission.mockImplementation((action: AccessControlAction) => {
        return action === AccessControlAction.AlertingReceiversRead;
      });

      const { result } = renderHook(() => useNotificationConfigNav());

      // eslint-disable-next-line testing-library/no-node-access
      expect(result.current.pageNav?.children).toBeUndefined();
    });
  });

  describe('when alertingNavigationV2 is disabled', () => {
    beforeEach(() => {
      config.featureToggles = { ...originalFeatureToggles, alertingNavigationV2: false };
    });

    it('should return the legacy navId', () => {
      const { result } = renderHook(() => useNotificationConfigNav());

      expect(result.current.navId).toBe('receivers');
      expect(result.current.pageNav).toBeUndefined();
    });
  });
});

describe('getNotificationConfigNavId', () => {
  const originalFeatureToggles = config.featureToggles;

  afterEach(() => {
    config.featureToggles = originalFeatureToggles;
  });

  it('should return notification-config when V2 is enabled', () => {
    config.featureToggles = { ...originalFeatureToggles, alertingNavigationV2: true };
    expect(getNotificationConfigNavId()).toBe('notification-config');
  });

  it('should return receivers when V2 is disabled', () => {
    config.featureToggles = { ...originalFeatureToggles, alertingNavigationV2: false };
    expect(getNotificationConfigNavId()).toBe('receivers');
  });
});

describe('consolidated navigation hooks', () => {
  const originalFeatureToggles = config.featureToggles;

  beforeEach(() => {
    jest.clearAllMocks();
    mockLocation('/alerting/notifications');
    mockHasPermission.mockReturnValue(true);
  });

  afterEach(() => {
    config.featureToggles = originalFeatureToggles;
  });

  describe('when alertingNavigationV2 is enabled', () => {
    beforeEach(() => {
      config.featureToggles = { ...originalFeatureToggles, alertingNavigationV2: true };
    });

    it('useContactPointsNav should return notification-config navId', () => {
      const { result } = renderHook(() => useContactPointsNav());
      expect(result.current.navId).toBe('notification-config');
    });

    it('useNotificationPoliciesNav should return notification-config navId', () => {
      const { result } = renderHook(() => useNotificationPoliciesNav());
      expect(result.current.navId).toBe('notification-config');
    });

    it('useTemplatesNav should return notification-config navId', () => {
      const { result } = renderHook(() => useTemplatesNav());
      expect(result.current.navId).toBe('notification-config');
    });

    it('useTimeIntervalsNav should return notification-config navId', () => {
      const { result } = renderHook(() => useTimeIntervalsNav());
      expect(result.current.navId).toBe('notification-config');
    });
  });

  describe('when alertingNavigationV2 is disabled', () => {
    beforeEach(() => {
      config.featureToggles = { ...originalFeatureToggles, alertingNavigationV2: false };
    });

    it('useContactPointsNav should return receivers navId', () => {
      const { result } = renderHook(() => useContactPointsNav());
      expect(result.current.navId).toBe('receivers');
    });

    it('useNotificationPoliciesNav should return am-routes navId', () => {
      const { result } = renderHook(() => useNotificationPoliciesNav());
      expect(result.current.navId).toBe('am-routes');
    });

    it('useTemplatesNav should return receivers navId', () => {
      const { result } = renderHook(() => useTemplatesNav());
      expect(result.current.navId).toBe('receivers');
    });

    it('useTimeIntervalsNav should return am-routes navId', () => {
      const { result } = renderHook(() => useTimeIntervalsNav());
      expect(result.current.navId).toBe('am-routes');
    });
  });
});
