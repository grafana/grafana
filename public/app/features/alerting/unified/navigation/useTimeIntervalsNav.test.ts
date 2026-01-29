import { config } from '@grafana/runtime';

import { useNotificationConfigNav } from './useNotificationConfigNav';
import { useTimeIntervalsNav } from './useTimeIntervalsNav';

// Mock useNotificationConfigNav
jest.mock('./useNotificationConfigNav', () => ({
  useNotificationConfigNav: jest.fn(),
}));

const mockUseNotificationConfigNav = useNotificationConfigNav as jest.Mock;

describe('useTimeIntervalsNav', () => {
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
            { id: 'notification-config-policies', text: 'Notification policies' },
            { id: 'notification-config-time-intervals', text: 'Time intervals' },
          ],
        },
      };
      mockUseNotificationConfigNav.mockReturnValue(mockTabNav);

      const result = useTimeIntervalsNav();

      expect(result).toEqual(mockTabNav);
      expect(mockUseNotificationConfigNav).toHaveBeenCalled();
    });
  });

  describe('when alertingNavigationV2 is disabled', () => {
    beforeEach(() => {
      config.featureToggles = { ...originalFeatureToggles, alertingNavigationV2: false };
    });

    it('should return the standalone nav ID for time intervals page', () => {
      mockUseNotificationConfigNav.mockReturnValue({ navId: 'receivers' });

      const result = useTimeIntervalsNav();

      // Time Intervals is accessed through Notification Policies in legacy nav
      expect(result).toEqual({ navId: 'am-routes' });
    });

    it('should not use the tabbed navigation from useNotificationConfigNav', () => {
      const mockTabNav = {
        navId: 'receivers',
        pageNav: undefined,
      };
      mockUseNotificationConfigNav.mockReturnValue(mockTabNav);

      const result = useTimeIntervalsNav();

      // Should return standalone nav ID
      expect(result.navId).toBe('am-routes');
      expect(result.pageNav).toBeUndefined();
    });
  });
});
