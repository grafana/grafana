import { render, screen } from '@testing-library/react';

import { BrandingContext } from '../Branding/BrandingContext';

import { PageLoader } from './PageLoader';

describe('PageLoader', () => {
  it('renders the default Grafana logo when no branding is provided', () => {
    render(<PageLoader />);

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Grafana' })).toBeInTheDocument();
  });

  it('renders the branded logo supplied via BrandingContext', () => {
    const AppLogo = () => <div data-testid="branded-logo" />;

    render(
      <BrandingContext.Provider value={{ AppLogo }}>
        <PageLoader />
      </BrandingContext.Provider>
    );

    expect(screen.getByTestId('branded-logo')).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: 'Grafana' })).not.toBeInTheDocument();
  });

  it('prefers explicit children over both branding and the default logo', () => {
    const AppLogo = () => <div data-testid="branded-logo" />;

    render(
      <BrandingContext.Provider value={{ AppLogo }}>
        <PageLoader>
          <div data-testid="explicit-logo" />
        </PageLoader>
      </BrandingContext.Provider>
    );

    expect(screen.getByTestId('explicit-logo')).toBeInTheDocument();
    expect(screen.queryByTestId('branded-logo')).not.toBeInTheDocument();
    expect(screen.queryByRole('img', { name: 'Grafana' })).not.toBeInTheDocument();
  });
});
