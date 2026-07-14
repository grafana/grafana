import { render } from 'test/test-utils';
import { byRole } from 'testing-library-selector';

import { ImportToGMABanner } from './ImportToGMABanner';
import { IMPORT_TO_GMA_BANNER_DISMISSED_KEY } from './useImportToGMABannerPrefs';

const ui = {
  banner: byRole('status'),
  openButton: byRole('link', { name: /import to grafana alerting/i }),
  closeButton: byRole('button', { name: /close/i }),
};

describe('ImportToGMABanner', () => {
  beforeEach(() => {
    localStorage.clear();
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
    expect(localStorage.getItem(IMPORT_TO_GMA_BANNER_DISMISSED_KEY)).toBeTruthy();
  });

  it('does not render when it was previously dismissed', () => {
    localStorage.setItem(IMPORT_TO_GMA_BANNER_DISMISSED_KEY, 'true');

    render(<ImportToGMABanner />);

    expect(ui.banner.query()).not.toBeInTheDocument();
  });
});
