import { render, screen, testWithFeatureToggles } from 'test/test-utils';
import { byRole, byText } from 'testing-library-selector';

import * as Analytics from '../Analytics';

import { AlertsActivityBanner } from './AlertsActivityBanner';

// Mock the analytics functions
jest.mock('../Analytics', () => ({
  ...jest.requireActual('../Analytics'),
  trackAlertsActivityBannerImpression: jest.fn(),
  trackAlertsActivityBannerClickTry: jest.fn(),
  trackAlertsActivityBannerDismiss: jest.fn(),
  getStackType: jest.fn(() => 'GMA'),
}));

const ui = {
  banner: byRole('region'),
  title: byText(/alert activity is now available/i),
  description: byText(/a brand new page is now available/i),
  dmaNote: byText(/some triage features may be limited/i),
  openButton: byRole('link', { name: /open alerts activity/i }),
};

const STORAGE_KEY_DISMISSED_UNTIL = 'grafana.alerting.alerts_activity_banner.dismissed_until';

describe('AlertsActivityBanner', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    // Reset stack type mock to GMA by default
    (Analytics.getStackType as jest.Mock).mockReturnValue('GMA');
  });

  describe('when feature toggle is disabled', () => {
    testWithFeatureToggles({ enable: [] });

    it('should not render when alertingTriage is disabled', () => {
      render(<AlertsActivityBanner />);

      expect(ui.banner.query()).not.toBeInTheDocument();
      expect(Analytics.trackAlertsActivityBannerImpression).not.toHaveBeenCalled();
    });
  });

  describe('when feature toggle is enabled', () => {
    testWithFeatureToggles({ enable: ['alertingTriage'] });

    it('should render the banner with correct content', () => {
      render(<AlertsActivityBanner />);

      expect(ui.title.get()).toBeInTheDocument();
      expect(ui.description.get()).toBeInTheDocument();
      expect(ui.openButton.get()).toBeInTheDocument();
    });

    it('should not have an opt-out button (handled by page title)', () => {
      render(<AlertsActivityBanner />);

      // The opt-out button should NOT be in the banner - it's in the page title now
      expect(screen.queryByRole('button', { name: /switch to old/i })).not.toBeInTheDocument();
    });

    it('should track impression on first render', () => {
      render(<AlertsActivityBanner />);

      expect(Analytics.trackAlertsActivityBannerImpression).toHaveBeenCalledTimes(1);
      expect(Analytics.trackAlertsActivityBannerImpression).toHaveBeenCalledWith();
    });

    it('should track impression only once across re-renders', () => {
      const { rerender } = render(<AlertsActivityBanner />);

      rerender(<AlertsActivityBanner />);
      rerender(<AlertsActivityBanner />);

      expect(Analytics.trackAlertsActivityBannerImpression).toHaveBeenCalledTimes(1);
    });

    it('should have correct href on Open Alerts Activity button', () => {
      render(<AlertsActivityBanner />);

      // LinkButton uses createRelativeUrl which adds the app subpath prefix
      expect(ui.openButton.get()).toHaveAttribute('href', expect.stringContaining('/alerting/alerts'));
    });

    it('should track click when Open Alerts Activity is clicked', async () => {
      const { user } = render(<AlertsActivityBanner />);

      // Prevent the actual navigation which jsdom doesn't support
      const button = ui.openButton.get();
      button.addEventListener('click', (e) => e.preventDefault(), { once: true });
      await user.click(button);

      expect(Analytics.trackAlertsActivityBannerClickTry).toHaveBeenCalledWith();
    });

    describe('dismiss functionality', () => {
      it('should hide banner and persist dismissal when dismiss button is clicked', async () => {
        const { user } = render(<AlertsActivityBanner />);

        // Find and click the close button (the X icon on the Alert)
        const closeButton = screen.getByRole('button', { name: /close/i });
        await user.click(closeButton);

        // Dismiss tracking receives the dismissed_until date
        expect(Analytics.trackAlertsActivityBannerDismiss).toHaveBeenCalledWith(expect.any(String));

        // Check localStorage was set
        const dismissedUntil = localStorage.getItem(STORAGE_KEY_DISMISSED_UNTIL);
        expect(dismissedUntil).toBeTruthy();

        // Verify the dismissal date is ~30 days in the future
        const dismissedDate = new Date(JSON.parse(dismissedUntil!));
        const expectedDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        expect(Math.abs(dismissedDate.getTime() - expectedDate.getTime())).toBeLessThan(5000);
      });
    });

    describe('persistence', () => {
      it('should not render when banner was recently dismissed', () => {
        const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        localStorage.setItem(STORAGE_KEY_DISMISSED_UNTIL, JSON.stringify(futureDate));

        render(<AlertsActivityBanner />);

        expect(ui.banner.query()).not.toBeInTheDocument();
        expect(Analytics.trackAlertsActivityBannerImpression).not.toHaveBeenCalled();
      });

      it('should render when dismissal has expired', () => {
        const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        localStorage.setItem(STORAGE_KEY_DISMISSED_UNTIL, JSON.stringify(pastDate));

        render(<AlertsActivityBanner />);

        expect(ui.banner.query()).toBeInTheDocument();
        expect(Analytics.trackAlertsActivityBannerImpression).toHaveBeenCalled();
      });
    });
  });

  describe('DMA stack detection', () => {
    testWithFeatureToggles({ enable: ['alertingTriage'] });

    it('should not show DMA note for GMA stack', () => {
      (Analytics.getStackType as jest.Mock).mockReturnValue('GMA');

      render(<AlertsActivityBanner />);

      expect(ui.dmaNote.query()).not.toBeInTheDocument();
    });

    it('should show DMA note when stack type is DMA', () => {
      (Analytics.getStackType as jest.Mock).mockReturnValue('DMA');

      render(<AlertsActivityBanner />);

      expect(ui.dmaNote.get()).toBeInTheDocument();
    });
  });
});
