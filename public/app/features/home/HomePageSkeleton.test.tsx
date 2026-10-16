import { render, screen } from 'test/test-utils';

import { HomePageSkeleton } from './HomePageSkeleton';

describe('HomePageSkeleton', () => {
  it('renders only the base tab/list skeleton by default', () => {
    render(<HomePageSkeleton />);
    expect(screen.getByTestId('home-page-skeleton')).toBeInTheDocument();
    expect(screen.queryByTestId('home-page-skeleton-cards')).not.toBeInTheDocument();
    expect(screen.queryByTestId('home-page-skeleton-extra')).not.toBeInTheDocument();
  });

  it('reserves the alerts card slot when showAlertsCard is set', () => {
    render(<HomePageSkeleton showAlertsCard />);
    expect(screen.getByTestId('home-page-skeleton-cards')).toBeInTheDocument();
  });

  it('reserves the IRM/news card slot when showIRMNewsCard is set', () => {
    render(<HomePageSkeleton showIRMNewsCard />);
    expect(screen.getByTestId('home-page-skeleton-cards')).toBeInTheDocument();
  });

  it('reserves the extra section when showExtra is set', () => {
    render(<HomePageSkeleton showExtra />);
    expect(screen.getByTestId('home-page-skeleton-extra')).toBeInTheDocument();
  });

  it('does not reserve the solutions block on the redesign without showSolutions', () => {
    render(<HomePageSkeleton redesignEnabled />);
    expect(screen.queryByTestId('home-page-skeleton-solutions')).not.toBeInTheDocument();
  });

  it('reserves the solutions block on the redesign when showSolutions is set', () => {
    render(<HomePageSkeleton redesignEnabled showSolutions />);
    expect(screen.getByTestId('home-page-skeleton-solutions')).toBeInTheDocument();
  });
});
