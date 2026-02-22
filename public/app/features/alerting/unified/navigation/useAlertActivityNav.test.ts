import { renderHook } from '@testing-library/react';

import { config } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

import { getAlertActivityNavId, useAlertActivityNav, useAlertGroupsNav, useAlertsNav } from './useAlertActivityNav';

// Mock dependencies
jest.mock('react-router-dom-v5-compat', () => ({
  useLocation: jest.fn(() => ({ pathname: '/alerting/alerts' })),
}));

jest.mock('app/types/store', () => ({
  useSelector: jest.fn((selector) =>
    selector({
      navIndex: {
        'alert-activity': {
          id: 'alert-activity',
          text: 'Alert activity',
          url: '/alerting/alerts',
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

describe('useAlertActivityNav', () => {
  const originalFeatureToggles = config.featureToggles;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    config.featureToggles = originalFeatureToggles;
  });

  describe('when alertingNavigationV2 is enabled', () => {
    beforeEach(() => {
      config.featureToggles = { ...originalFeatureToggles, alertingNavigationV2: true };
    });

    it('should return navId alert-activity', () => {
      mockHasPermission.mockReturnValue(true);

      const { result } = renderHook(() => useAlertActivityNav());

      expect(result.current.navId).toBe('alert-activity');
    });

    it('should return pageNav with tabs when user has all permissions', () => {
      mockHasPermission.mockReturnValue(true);

      const { result } = renderHook(() => useAlertActivityNav());

      expect(result.current.pageNav).toBeDefined();
      // Note: children here refers to NavModelItem.children (tab items), not DOM children
      // eslint-disable-next-line testing-library/no-node-access
      expect(result.current.pageNav?.children).toHaveLength(2);
      // eslint-disable-next-line testing-library/no-node-access
      expect(result.current.pageNav?.children?.[0].id).toBe('alert-activity-alerts');
      // eslint-disable-next-line testing-library/no-node-access
      expect(result.current.pageNav?.children?.[1].id).toBe('alert-activity-notifications');
    });

    it('should filter tabs based on permissions - only alerts', () => {
      // Only allow alerts (rule read permission)
      mockHasPermission.mockImplementation((action: AccessControlAction) => {
        return action === AccessControlAction.AlertingRuleRead;
      });

      const { result } = renderHook(() => useAlertActivityNav());

      // Single tab should not show tabs bar
      // eslint-disable-next-line testing-library/no-node-access
      expect(result.current.pageNav?.children).toBeUndefined();
    });

    it('should filter tabs based on permissions - only active notifications', () => {
      // Only allow active notifications (instance read permission)
      mockHasPermission.mockImplementation((action: AccessControlAction) => {
        return action === AccessControlAction.AlertingInstanceRead;
      });

      const { result } = renderHook(() => useAlertActivityNav());

      // Single tab should not show tabs bar
      // eslint-disable-next-line testing-library/no-node-access
      expect(result.current.pageNav?.children).toBeUndefined();
    });

    it('should not show tabs bar when only one tab is visible', () => {
      // Only allow alerts
      mockHasPermission.mockImplementation((action: AccessControlAction) => {
        return action === AccessControlAction.AlertingRuleRead;
      });

      const { result } = renderHook(() => useAlertActivityNav());

      // eslint-disable-next-line testing-library/no-node-access
      expect(result.current.pageNav?.children).toBeUndefined();
    });
  });

  describe('when alertingNavigationV2 is disabled', () => {
    beforeEach(() => {
      config.featureToggles = { ...originalFeatureToggles, alertingNavigationV2: false };
    });

    it('should return the legacy navId', () => {
      const { result } = renderHook(() => useAlertActivityNav());

      expect(result.current.navId).toBe('alert-alerts');
      expect(result.current.pageNav).toBeUndefined();
    });
  });
});

describe('getAlertActivityNavId', () => {
  const originalFeatureToggles = config.featureToggles;

  afterEach(() => {
    config.featureToggles = originalFeatureToggles;
  });

  it('should return alert-activity when V2 is enabled', () => {
    config.featureToggles = { ...originalFeatureToggles, alertingNavigationV2: true };
    expect(getAlertActivityNavId()).toBe('alert-activity');
  });

  it('should return alert-alerts when V2 is disabled', () => {
    config.featureToggles = { ...originalFeatureToggles, alertingNavigationV2: false };
    expect(getAlertActivityNavId()).toBe('alert-alerts');
  });
});

describe('consolidated navigation hooks', () => {
  const originalFeatureToggles = config.featureToggles;

  beforeEach(() => {
    jest.clearAllMocks();
    mockHasPermission.mockReturnValue(true);
  });

  afterEach(() => {
    config.featureToggles = originalFeatureToggles;
  });

  describe('when alertingNavigationV2 is enabled', () => {
    beforeEach(() => {
      config.featureToggles = { ...originalFeatureToggles, alertingNavigationV2: true };
    });

    it('useAlertsNav should return alert-activity navId', () => {
      const { result } = renderHook(() => useAlertsNav());
      expect(result.current.navId).toBe('alert-activity');
    });

    it('useAlertGroupsNav should return alert-activity navId', () => {
      const { result } = renderHook(() => useAlertGroupsNav());
      expect(result.current.navId).toBe('alert-activity');
    });
  });

  describe('when alertingNavigationV2 is disabled', () => {
    beforeEach(() => {
      config.featureToggles = { ...originalFeatureToggles, alertingNavigationV2: false };
    });

    it('useAlertsNav should return alert-alerts navId', () => {
      const { result } = renderHook(() => useAlertsNav());
      expect(result.current.navId).toBe('alert-alerts');
    });

    it('useAlertGroupsNav should return groups navId', () => {
      const { result } = renderHook(() => useAlertGroupsNav());
      expect(result.current.navId).toBe('groups');
    });
  });
});
