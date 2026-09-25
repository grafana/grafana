import { render } from 'test/test-utils';
import { byRole } from 'testing-library-selector';

import { config } from '@grafana/runtime';

import { ImportToGMABanner } from './ImportToGMABanner';
import { getImportToGMABannerDismissedKey } from './useImportToGMABannerPrefs';

const dismissedKey = getImportToGMABannerDismissedKey(config.bootData.user.orgId);

const ui = {
  banner: byRole('status'),
  openButton: byRole('link', { name: /import to grafana alerting/i }),
  closeButton: byRole('button', { name: /close/i }),
};

describe('ImportToGMABanner', () => {
  beforeEach(() => {
    localStorage.removeItem(dismissedKey);
  });

  it('renders the banner with a CTA to the import wizard', () => {
    render(<ImportToGMABanner />);

    expect(ui.banner.get()).toBeInTheDocument();
    expect(ui.openButton.get()).toHaveAttribute('href', expect.stringContaining('/alerting/import-to-gma'));
  });

  it('persists dismissal and hides the banner when dismissed', async () => {
    const { user } = render(<ImportToGMABanner />);

    await user.click(ui.closeButton.get());

    expect(ui.banner.query()).not.toBeInTheDocument();
    expect(localStorage.getItem(dismissedKey)).toBeTruthy();
  });

  it('does not render when it was previously dismissed', () => {
    localStorage.setItem(dismissedKey, 'true');

    render(<ImportToGMABanner />);

    expect(ui.banner.query()).not.toBeInTheDocument();
  });

  it('still renders when only another org dismissed the banner', () => {
    localStorage.setItem(getImportToGMABannerDismissedKey(config.bootData.user.orgId + 1), 'true');

    render(<ImportToGMABanner />);

    expect(ui.banner.get()).toBeInTheDocument();
  });
});
