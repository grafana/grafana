import { render, screen } from '@testing-library/react';
import { TestProvider } from 'test/helpers/TestProvider';
import { getGrafanaContextMock } from 'test/mocks/getGrafanaContextMock';

import { selectors } from '@grafana/e2e-selectors';

import { DashboardBrandingFooter, DashboardBrandingFooterVariant } from './DashboardBrandingFooter';
import { setPublicDashboardConfigFn } from './usePublicDashboardConfig';

function renderFooter(
  props: Partial<React.ComponentProps<typeof DashboardBrandingFooter>> = {},
  configOverrides: Parameters<typeof setPublicDashboardConfigFn>[0] = {
    footerHide: false,
    footerText: 'Powered by',
    footerLogo: 'grafana-logo',
    footerLink: 'https://grafana.com/?src=grafananet&cnt=public-dashboards',
    headerLogoHide: false,
  }
) {
  setPublicDashboardConfigFn(configOverrides);

  return render(
    <TestProvider grafanaContext={getGrafanaContextMock()}>
      <DashboardBrandingFooter {...props} />
    </TestProvider>
  );
}

describe('DashboardBrandingFooter', () => {
  it('hides when hide is true', () => {
    renderFooter({ variant: DashboardBrandingFooterVariant.Kiosk, hide: true });

    expect(screen.queryByTestId(selectors.pages.PublicDashboard.footer)).not.toBeInTheDocument();
  });

  it('Public variant respects public dashboard config footerHide', () => {
    renderFooter(
      { variant: DashboardBrandingFooterVariant.Public },
      {
        footerHide: true,
        footerText: 'Powered by',
        footerLogo: 'grafana-logo',
        footerLink: 'https://grafana.com/?src=grafananet&cnt=public-dashboards',
        headerLogoHide: false,
      }
    );

    expect(screen.queryByTestId(selectors.pages.PublicDashboard.footer)).not.toBeInTheDocument();
  });

  it('Kiosk variant ignores public dashboard config footerHide and uses the kiosk CTA url by default', () => {
    renderFooter(
      { variant: DashboardBrandingFooterVariant.Kiosk },
      {
        footerHide: true,
        footerText: 'SHOULD NOT BE USED',
        footerLogo: 'SHOULD NOT BE USED',
        footerLink: 'https://example.invalid',
        headerLogoHide: false,
      }
    );

    const footer = screen.getByTestId(selectors.pages.PublicDashboard.footer);
    const link = footer.querySelector('a');
    expect(link).toHaveAttribute('href', 'https://grafana.com/?src=grafananet&cnt=kiosk-dashboard');
  });

  it('sanitizes linkUrl overrides', () => {
    renderFooter({ variant: DashboardBrandingFooterVariant.Kiosk, linkUrl: 'javascript:alert(1)' });

    const footer = screen.getByTestId(selectors.pages.PublicDashboard.footer);
    const link = footer.querySelector('a');
    expect(link).toHaveAttribute('href', 'about:blank');
  });

  it('renders a logo img by default in Kiosk variant', () => {
    renderFooter({ variant: DashboardBrandingFooterVariant.Kiosk });

    const footer = screen.getByTestId(selectors.pages.PublicDashboard.footer);
    const img = footer.querySelector('img');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src');
    expect(img?.getAttribute('src')).not.toBe('');
  });

  it('hides the logo img when logo is an empty string', () => {
    renderFooter({ variant: DashboardBrandingFooterVariant.Kiosk, logo: '' });

    const footer = screen.getByTestId(selectors.pages.PublicDashboard.footer);
    expect(footer.querySelector('img')).toBeNull();
  });
});
