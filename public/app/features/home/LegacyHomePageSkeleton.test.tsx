import { render, screen } from 'test/test-utils';

import { LegacyHomePageSkeleton } from './LegacyHomePageSkeleton';

describe('LegacyHomePageSkeleton', () => {
  it('renders only the base tab/list skeleton by default', () => {
    render(<LegacyHomePageSkeleton />);
    expect(screen.getByTestId('home-page-skeleton')).toBeInTheDocument();
    expect(screen.queryByTestId('home-page-skeleton-cards')).not.toBeInTheDocument();
    expect(screen.queryByTestId('home-page-skeleton-extra')).not.toBeInTheDocument();
  });

  it('reserves the alerts card slot when showAlertsCard is set', () => {
    render(<LegacyHomePageSkeleton showAlertsCard />);
    expect(screen.getByTestId('home-page-skeleton-cards')).toBeInTheDocument();
  });

  it('reserves the IRM/news card slot when showIRMNewsCard is set', () => {
    render(<LegacyHomePageSkeleton showIRMNewsCard />);
    expect(screen.getByTestId('home-page-skeleton-cards')).toBeInTheDocument();
  });

  it('reserves the extra section when showExtra is set', () => {
    render(<LegacyHomePageSkeleton showExtra />);
    expect(screen.getByTestId('home-page-skeleton-extra')).toBeInTheDocument();
  });
});
