import { config } from '@grafana/runtime';

import { useAlertRulesNav } from './useAlertRulesNav';
import { useDeletedRulesNav } from './useDeletedRulesNav';

// Mock useAlertRulesNav
jest.mock('./useAlertRulesNav', () => ({
  useAlertRulesNav: jest.fn(),
}));

const mockUseAlertRulesNav = useAlertRulesNav as jest.Mock;

describe('useDeletedRulesNav', () => {
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

    it('should return the tabbed navigation from useAlertRulesNav', () => {
      const mockTabNav = {
        navId: 'alert-rules',
        pageNav: {
          id: 'alert-rules',
          text: 'Alert rules',
          children: [
            { id: 'alert-rules-list', text: 'Alert rules' },
            { id: 'alert-rules-recently-deleted', text: 'Recently deleted' },
          ],
        },
      };
      mockUseAlertRulesNav.mockReturnValue(mockTabNav);

      const result = useDeletedRulesNav();

      expect(result).toEqual(mockTabNav);
      expect(mockUseAlertRulesNav).toHaveBeenCalled();
    });
  });

  describe('when alertingNavigationV2 is disabled', () => {
    beforeEach(() => {
      config.featureToggles = { ...originalFeatureToggles, alertingNavigationV2: false };
    });

    it('should return the standalone nav ID for recently deleted page', () => {
      mockUseAlertRulesNav.mockReturnValue({ navId: 'alert-list' });

      const result = useDeletedRulesNav();

      expect(result).toEqual({ navId: 'alerts/recently-deleted' });
    });

    it('should not use the tabbed navigation from useAlertRulesNav', () => {
      const mockTabNav = {
        navId: 'alert-list',
        pageNav: undefined,
      };
      mockUseAlertRulesNav.mockReturnValue(mockTabNav);

      const result = useDeletedRulesNav();

      // Should return standalone nav ID, ignoring useAlertRulesNav result
      expect(result.navId).toBe('alerts/recently-deleted');
      expect(result.pageNav).toBeUndefined();
    });
  });
});
