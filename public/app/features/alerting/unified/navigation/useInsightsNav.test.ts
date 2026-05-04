import { renderHook } from '@testing-library/react';

import { config } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

import { getInsightsNavId, useAlertHistoryNav, useInsightsNav, useNotificationHistoryNav } from './useInsightsNav';

// Mock dependencies
jest.mock('react-router-dom-v5-compat', () => ({
  useLocation: jest.fn(() => ({ pathname: '/alerting/insights' })),
}));

jest.mock('app/types/store', () => ({
  useSelector: jest.fn((selector) =>
    selector({
      navIndex: {
        insights: {
          id: 'insights',
          text: 'Insights',
          url: '/alerting/insights',
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

jest.mock('../home/Insights', () => ({
  insightsIsAvailable: jest.fn(() => true),
}));

jest.mock('../utils/misc', () => ({
  isLocalDevEnv: jest.fn(() => false),
}));

const mockHasPermission = contextSrv.hasPermission as jest.Mock;

describe('useInsightsNav', () => {
  const originalFeatureToggles = config.featureToggles;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    config.featureToggles = originalFeatureToggles;
  });

  describe('when alertingNavigationV2 is enabled', () => {
    beforeEach(() => {
      config.featureToggles = {
        ...originalFeatureToggles,
        alertingNavigationV2: true,
        alertingCentralAlertHistory: true,
        alertingNotificationHistoryGlobal: true,
      };
    });

    it('should return navId insights', () => {
      mockHasPermission.mockReturnValue(true);

      const { result } = renderHook(() => useInsightsNav());

      expect(result.current.navId).toBe('insights');
    });

    it('should return pageNav with all tabs when user has all permissions', () => {
      mockHasPermission.mockReturnValue(true);

      const { result } = renderHook(() => useInsightsNav());

      expect(result.current.pageNav).toBeDefined();
      // Note: children here refers to NavModelItem.children (tab items), not DOM children
      // eslint-disable-next-line testing-library/no-node-access
      expect(result.current.pageNav?.children).toHaveLength(3);
      // eslint-disable-next-line testing-library/no-node-access
      expect(result.current.pageNav?.children?.[0].id).toBe('insights-system');
      // eslint-disable-next-line testing-library/no-node-access
      expect(result.current.pageNav?.children?.[1].id).toBe('insights-alert-history');
      // eslint-disable-next-line testing-library/no-node-access
      expect(result.current.pageNav?.children?.[2].id).toBe('insights-notification-history');
    });

    it('should filter alert history tab based on permissions', () => {
      // Only allow non-alerting-rule-read permissions
      mockHasPermission.mockImplementation((action: AccessControlAction) => {
        return action !== AccessControlAction.AlertingRuleRead;
      });

      const { result } = renderHook(() => useInsightsNav());

      // Should have System insights and Notification history, but not Alert state history
      // eslint-disable-next-line testing-library/no-node-access
      expect(result.current.pageNav?.children).toHaveLength(2);
      // eslint-disable-next-line testing-library/no-node-access
      expect(result.current.pageNav?.children?.[0].id).toBe('insights-system');
      // eslint-disable-next-line testing-library/no-node-access
      expect(result.current.pageNav?.children?.[1].id).toBe('insights-notification-history');
    });

    it('should hide alert history tab when feature flag is disabled', () => {
      config.featureToggles = {
        ...config.featureToggles,
        alertingCentralAlertHistory: false,
      };
      mockHasPermission.mockReturnValue(true);

      const { result } = renderHook(() => useInsightsNav());

      // Should have System insights and Notification history
      // eslint-disable-next-line testing-library/no-node-access
      expect(result.current.pageNav?.children).toHaveLength(2);
      // eslint-disable-next-line testing-library/no-node-access
      expect(result.current.pageNav?.children?.[0].id).toBe('insights-system');
      // eslint-disable-next-line testing-library/no-node-access
      expect(result.current.pageNav?.children?.[1].id).toBe('insights-notification-history');
    });

    it('should hide notification history tab when feature flag is disabled', () => {
      config.featureToggles = {
        ...config.featureToggles,
        alertingNotificationHistoryGlobal: false,
      };
      mockHasPermission.mockReturnValue(true);

      const { result } = renderHook(() => useInsightsNav());

      // Should have System insights and Alert state history
      // eslint-disable-next-line testing-library/no-node-access
      expect(result.current.pageNav?.children).toHaveLength(2);
      // eslint-disable-next-line testing-library/no-node-access
      expect(result.current.pageNav?.children?.[0].id).toBe('insights-system');
      // eslint-disable-next-line testing-library/no-node-access
      expect(result.current.pageNav?.children?.[1].id).toBe('insights-alert-history');
    });

    it('should hide system insights when datasources are not available', () => {
      const { insightsIsAvailable } = require('../home/Insights');
      (insightsIsAvailable as jest.Mock).mockReturnValue(false);
      mockHasPermission.mockReturnValue(true);

      const { result } = renderHook(() => useInsightsNav());

      // Should have Alert state history and Notification history
      // eslint-disable-next-line testing-library/no-node-access
      expect(result.current.pageNav?.children).toHaveLength(2);
      // eslint-disable-next-line testing-library/no-node-access
      expect(result.current.pageNav?.children?.[0].id).toBe('insights-alert-history');
      // eslint-disable-next-line testing-library/no-node-access
      expect(result.current.pageNav?.children?.[1].id).toBe('insights-notification-history');
    });

    it('should not show tabs bar when only one tab is visible', () => {
      config.featureToggles = {
        ...config.featureToggles,
        alertingCentralAlertHistory: false,
        alertingNotificationHistoryGlobal: false,
      };
      mockHasPermission.mockReturnValue(true);

      const { result } = renderHook(() => useInsightsNav());

      // Single tab should not show tabs bar
      // eslint-disable-next-line testing-library/no-node-access
      expect(result.current.pageNav?.children).toBeUndefined();
    });
  });

  describe('when alertingNavigationV2 is disabled', () => {
    beforeEach(() => {
      config.featureToggles = { ...originalFeatureToggles, alertingNavigationV2: false };
    });

    it('should return the legacy navId', () => {
      const { result } = renderHook(() => useInsightsNav());

      expect(result.current.navId).toBe('alerts-history');
      expect(result.current.pageNav).toBeUndefined();
    });
  });
});

describe('getInsightsNavId', () => {
  const originalFeatureToggles = config.featureToggles;

  afterEach(() => {
    config.featureToggles = originalFeatureToggles;
  });

  it('should return insights when V2 is enabled', () => {
    config.featureToggles = { ...originalFeatureToggles, alertingNavigationV2: true };
    expect(getInsightsNavId()).toBe('insights');
  });

  it('should return alerts-history when V2 is disabled', () => {
    config.featureToggles = { ...originalFeatureToggles, alertingNavigationV2: false };
    expect(getInsightsNavId()).toBe('alerts-history');
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
      config.featureToggles = {
        ...originalFeatureToggles,
        alertingNavigationV2: true,
        alertingCentralAlertHistory: true,
        alertingNotificationHistoryGlobal: true,
      };
    });

    it('useAlertHistoryNav should return insights navId', () => {
      const { result } = renderHook(() => useAlertHistoryNav());
      expect(result.current.navId).toBe('insights');
    });

    it('useNotificationHistoryNav should return insights navId', () => {
      const { result } = renderHook(() => useNotificationHistoryNav());
      expect(result.current.navId).toBe('insights');
    });
  });

  describe('when alertingNavigationV2 is disabled', () => {
    beforeEach(() => {
      config.featureToggles = { ...originalFeatureToggles, alertingNavigationV2: false };
    });

    it('useAlertHistoryNav should return alerts-history navId', () => {
      const { result } = renderHook(() => useAlertHistoryNav());
      expect(result.current.navId).toBe('alerts-history');
    });

    it('useNotificationHistoryNav should return alerts-notifications navId', () => {
      const { result } = renderHook(() => useNotificationHistoryNav());
      expect(result.current.navId).toBe('alerts-notifications');
    });
  });
});
