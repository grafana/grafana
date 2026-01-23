import { config } from '@grafana/runtime';

import { useNotificationConfigNav } from './useNotificationConfigNav';
import { useNotificationPoliciesNav } from './useNotificationPoliciesNav';

// Mock useNotificationConfigNav
jest.mock('./useNotificationConfigNav', () => ({
  useNotificationConfigNav: jest.fn(),
}));

const mockUseNotificationConfigNav = useNotificationConfigNav as jest.Mock;

describe('useNotificationPoliciesNav', () => {
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

    it('should return the tabbed navigation from useNotificationConfigNav', () => {
      const mockTabNav = {
        navId: 'notification-config',
        pageNav: {
          id: 'notification-config',
          text: 'Notification configuration',
          children: [
            { id: 'notification-config-contact-points', text: 'Contact points' },
            { id: 'notification-config-policies', text: 'Notification policies' },
          ],
        },
      };
      mockUseNotificationConfigNav.mockReturnValue(mockTabNav);

      const result = useNotificationPoliciesNav();

      expect(result).toEqual(mockTabNav);
      expect(mockUseNotificationConfigNav).toHaveBeenCalled();
    });
  });

  describe('when alertingNavigationV2 is disabled', () => {
    beforeEach(() => {
      config.featureToggles = { ...originalFeatureToggles, alertingNavigationV2: false };
    });

    it('should return the standalone nav ID for notification policies page', () => {
      mockUseNotificationConfigNav.mockReturnValue({ navId: 'receivers' });

      const result = useNotificationPoliciesNav();

      expect(result).toEqual({ navId: 'am-routes' });
    });

    it('should not use the tabbed navigation from useNotificationConfigNav', () => {
      const mockTabNav = {
        navId: 'receivers',
        pageNav: undefined,
      };
      mockUseNotificationConfigNav.mockReturnValue(mockTabNav);

      const result = useNotificationPoliciesNav();

      // Should return standalone nav ID
      expect(result.navId).toBe('am-routes');
      expect(result.pageNav).toBeUndefined();
    });
  });
});
