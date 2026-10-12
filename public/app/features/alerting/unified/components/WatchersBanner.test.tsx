import { render } from 'test/test-utils';
import { byRole } from 'testing-library-selector';

import { config } from '@grafana/runtime';

import { WatchersBanner, getWatchersBannerDismissedKey } from './WatchersBanner';

const dismissedKey = getWatchersBannerDismissedKey(config.bootData.user.orgId);

const ui = {
  banner: byRole('status'),
  openButton: byRole('link', { name: /create a watcher/i }),
  closeButton: byRole('button', { name: /close/i }),
};

describe('WatchersBanner', () => {
  beforeEach(() => {
    localStorage.removeItem(dismissedKey);
  });

  it('renders the banner with a CTA to the Watchers page', () => {
    render(<WatchersBanner />);

    expect(ui.banner.get()).toBeInTheDocument();
    expect(ui.openButton.get()).toHaveAttribute('href', expect.stringContaining('/a/grafana-assistant-app/watchers'));
  });

  it('persists dismissal and hides the banner when dismissed', async () => {
    const { user } = render(<WatchersBanner />);

    await user.click(ui.closeButton.get());

    expect(ui.banner.query()).not.toBeInTheDocument();
    expect(localStorage.getItem(dismissedKey)).toBeTruthy();
  });

  it('does not render when it was previously dismissed', () => {
    localStorage.setItem(dismissedKey, 'true');

    render(<WatchersBanner />);

    expect(ui.banner.query()).not.toBeInTheDocument();
  });

  it('still renders when only another org dismissed the banner', () => {
    localStorage.setItem(getWatchersBannerDismissedKey(config.bootData.user.orgId + 1), 'true');

    render(<WatchersBanner />);

    expect(ui.banner.get()).toBeInTheDocument();
  });
});
