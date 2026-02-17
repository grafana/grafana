import { render, screen, testWithFeatureToggles } from 'test/test-utils';
import { byRole, byText } from 'testing-library-selector';

import { AlertsActivityBanner } from './AlertsActivityBanner';

// Mock Analytics to prevent tracking side effects
jest.mock('../Analytics', () => ({
  trackAlertsActivityBannerImpression: jest.fn(),
  trackAlertsActivityBannerClickTry: jest.fn(),
  trackAlertsActivityBannerDismiss: jest.fn(),
}));

const ui = {
  banner: byRole('status'),
  title: byText(/alert activity is now available/i),
  description: byText(/a brand new page is now available/i),
  openButton: byRole('link', { name: /open alerts activity/i }),
};

const STORAGE_KEY_DISMISSED_UNTIL = 'grafana.alerting.alerts_activity_banner.dismissed_until';

describe('AlertsActivityBanner', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  describe('when feature toggles are disabled', () => {
    testWithFeatureToggles({ enable: [] });

    it('should not render when feature toggles are disabled', () => {
      render(<AlertsActivityBanner />);

      expect(ui.banner.query()).not.toBeInTheDocument();
    });
  });

  describe('when feature toggles are enabled', () => {
    // Both alertingAlertsActivityBanner and alertingTriage are required
    testWithFeatureToggles({ enable: ['alertingAlertsActivityBanner', 'alertingTriage'] });

    it('should render the banner with correct content', () => {
      render(<AlertsActivityBanner />);

      expect(ui.title.get()).toBeInTheDocument();
      expect(ui.description.get()).toBeInTheDocument();
      expect(ui.openButton.get()).toBeInTheDocument();
    });

    it('should have correct href on Open Alerts Activity button', () => {
      render(<AlertsActivityBanner />);

      expect(ui.openButton.get()).toHaveAttribute('href', expect.stringContaining('/alerting/alerts'));
    });

    describe('dismiss functionality', () => {
      it('should persist dismissal for 30 days when dismiss button is clicked', async () => {
        const { user } = render(<AlertsActivityBanner />);

        const closeButton = screen.getByRole('button', { name: /close/i });
        await user.click(closeButton);

        // Check localStorage was set
        const dismissedUntil = localStorage.getItem(STORAGE_KEY_DISMISSED_UNTIL);
        expect(dismissedUntil).toBeTruthy();

        // Verify the dismissal date is ~30 days in the future
        const dismissedDate = new Date(dismissedUntil!);
        const expectedDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        expect(Math.abs(dismissedDate.getTime() - expectedDate.getTime())).toBeLessThan(5000);
      });
    });

    describe('persistence', () => {
      it('should not render when banner was recently dismissed', () => {
        const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        localStorage.setItem(STORAGE_KEY_DISMISSED_UNTIL, futureDate);

        render(<AlertsActivityBanner />);

        expect(ui.banner.query()).not.toBeInTheDocument();
      });

      it('should render when dismissal has expired', () => {
        const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        localStorage.setItem(STORAGE_KEY_DISMISSED_UNTIL, pastDate);

        render(<AlertsActivityBanner />);

        expect(ui.banner.query()).toBeInTheDocument();
      });
    });
  });
});
