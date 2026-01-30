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
  useLocation: jest.fn(() => ({ pathname: '/alerting/notifications' })),
}));

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

      const result = useNotificationConfigNav();

      expect(result.navId).toBe('notification-config');
    });

    it('should return pageNav with tabs when user has all permissions', () => {
      mockHasPermission.mockReturnValue(true);

      const result = useNotificationConfigNav();

      expect(result.pageNav).toBeDefined();
      expect(result.pageNav?.children).toHaveLength(4);
      expect(result.pageNav?.children?.[0].id).toBe('notification-config-contact-points');
      expect(result.pageNav?.children?.[1].id).toBe('notification-config-policies');
      expect(result.pageNav?.children?.[2].id).toBe('notification-config-templates');
      expect(result.pageNav?.children?.[3].id).toBe('notification-config-time-intervals');
    });

    it('should filter tabs based on permissions', () => {
      // Only allow contact points and templates
      mockHasPermission.mockImplementation((action: AccessControlAction) => {
        return (
          action === AccessControlAction.AlertingReceiversRead || action === AccessControlAction.AlertingTemplatesRead
        );
      });

      const result = useNotificationConfigNav();

      expect(result.pageNav?.children).toHaveLength(2);
      expect(result.pageNav?.children?.[0].id).toBe('notification-config-contact-points');
      expect(result.pageNav?.children?.[1].id).toBe('notification-config-templates');
    });

    it('should not show tabs bar when only one tab is visible', () => {
      // Only allow contact points
      mockHasPermission.mockImplementation((action: AccessControlAction) => {
        return action === AccessControlAction.AlertingReceiversRead;
      });

      const result = useNotificationConfigNav();

      expect(result.pageNav?.children).toBeUndefined();
    });
  });

  describe('when alertingNavigationV2 is disabled', () => {
    beforeEach(() => {
      config.featureToggles = { ...originalFeatureToggles, alertingNavigationV2: false };
    });

    it('should return the legacy navId', () => {
      const result = useNotificationConfigNav();

      expect(result.navId).toBe('receivers');
      expect(result.pageNav).toBeUndefined();
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
      const result = useContactPointsNav();
      expect(result.navId).toBe('notification-config');
    });

    it('useNotificationPoliciesNav should return notification-config navId', () => {
      const result = useNotificationPoliciesNav();
      expect(result.navId).toBe('notification-config');
    });

    it('useTemplatesNav should return notification-config navId', () => {
      const result = useTemplatesNav();
      expect(result.navId).toBe('notification-config');
    });

    it('useTimeIntervalsNav should return notification-config navId', () => {
      const result = useTimeIntervalsNav();
      expect(result.navId).toBe('notification-config');
    });
  });

  describe('when alertingNavigationV2 is disabled', () => {
    beforeEach(() => {
      config.featureToggles = { ...originalFeatureToggles, alertingNavigationV2: false };
    });

    it('useContactPointsNav should return receivers navId', () => {
      const result = useContactPointsNav();
      expect(result.navId).toBe('receivers');
    });

    it('useNotificationPoliciesNav should return am-routes navId', () => {
      const result = useNotificationPoliciesNav();
      expect(result.navId).toBe('am-routes');
    });

    it('useTemplatesNav should return receivers navId', () => {
      const result = useTemplatesNav();
      expect(result.navId).toBe('receivers');
    });

    it('useTimeIntervalsNav should return am-routes navId', () => {
      const result = useTimeIntervalsNav();
      expect(result.navId).toBe('am-routes');
    });
  });
});
