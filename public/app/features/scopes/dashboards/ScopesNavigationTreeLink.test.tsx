import { render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom-v5-compat';

import { ScopesNavigationTreeLink } from './ScopesNavigationTreeLink';

// Mock react-router-dom's useLocation
jest.mock('react-router-dom-v5-compat', () => ({
  ...jest.requireActual('react-router-dom-v5-compat'),
  useLocation: jest.fn(),
}));

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
};

describe('ScopesNavigationTreeLink', () => {
  const mockUseLocation = useLocation as jest.Mock;

  beforeEach(() => {
    mockUseLocation.mockReturnValue({ pathname: '/current-path' });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders link with correct props', () => {
    renderWithRouter(<ScopesNavigationTreeLink to="/test-path" title="Test Link" id="test-id" />);

    const link = screen.getByTestId('scopes-dashboards-test-id');
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/test-path');
    expect(link).toHaveAttribute('role', 'treeitem');
    expect(link).toHaveTextContent('Test Link');
  });

  it('sets aria-current when path matches', () => {
    mockUseLocation.mockReturnValue({ pathname: '/test-path' });

    renderWithRouter(<ScopesNavigationTreeLink to="/test-path" title="Test Link" id="test-id" />);

    const link = screen.getByTestId('scopes-dashboards-test-id');
    expect(link).toHaveAttribute('aria-current', 'page');
  });

  it('does not set aria-current when path does not match', () => {
    mockUseLocation.mockReturnValue({ pathname: '/different-path' });

    renderWithRouter(<ScopesNavigationTreeLink to="/test-path" title="Test Link" id="test-id" />);

    const link = screen.getByTestId('scopes-dashboards-test-id');
    expect(link).not.toHaveAttribute('aria-current');
  });

  it('handles dashboard paths correctly', () => {
    mockUseLocation.mockReturnValue({ pathname: '/d/dashboard1/some-details' });

    renderWithRouter(<ScopesNavigationTreeLink to="/d/dashboard1" title="Dashboard Link" id="dashboard-id" />);

    const link = screen.getByTestId('scopes-dashboards-dashboard-id');
    expect(link).toHaveAttribute('aria-current', 'page');
  });

  it('does not match when path is just the start of another path', () => {
    mockUseLocation.mockReturnValue({ pathname: '/test-path/extra' });

    renderWithRouter(<ScopesNavigationTreeLink to="/test-path" title="Test Link" id="test-id" />);

    const link = screen.getByTestId('scopes-dashboards-test-id');
    expect(link).not.toHaveAttribute('aria-current');
  });

  it('only highlights the matching link when multiple links are present', () => {
    mockUseLocation.mockReturnValue({ pathname: '/test-path' });

    renderWithRouter(
      <>
        <ScopesNavigationTreeLink to="/test-path" title="Matching Link" id="matching-id" />
        <ScopesNavigationTreeLink to="/test-path-extra" title="Other Link" id="other-id" />
      </>
    );

    const matchingLink = screen.getByTestId('scopes-dashboards-matching-id');
    const otherLink = screen.getByTestId('scopes-dashboards-other-id');

    expect(matchingLink).toHaveAttribute('aria-current', 'page');
    expect(otherLink).not.toHaveAttribute('aria-current');
  });

  it('matches path correctly when current location has query parameters', () => {
    mockUseLocation.mockReturnValue({
      pathname: '/test-path',
    });

    renderWithRouter(
      <>
        <ScopesNavigationTreeLink to="/test-path?param1=value1&param2=value2" title="Matching Link" id="matching-id" />
        <ScopesNavigationTreeLink to="/test-path-other" title="Other Link" id="other-id" />
      </>
    );

    const matchingLink = screen.getByTestId('scopes-dashboards-matching-id');
    const otherLink = screen.getByTestId('scopes-dashboards-other-id');

    expect(matchingLink).toHaveAttribute('aria-current', 'page');
    expect(otherLink).not.toHaveAttribute('aria-current');
  });
});
