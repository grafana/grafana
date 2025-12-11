import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom-v5-compat';

import { locationService } from '@grafana/runtime';

import { ScopesNavigationTreeLink } from './ScopesNavigationTreeLink';

// Mock react-router-dom's useLocation
jest.mock('react-router-dom-v5-compat', () => ({
  ...jest.requireActual('react-router-dom-v5-compat'),
  useLocation: jest.fn(),
}));

// Mock @grafana/runtime
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  locationService: {
    push: jest.fn(),
  },
}));

// Mock ScopesContextProvider
const mockScopesSelectorService = {
  state: {
    appliedScopes: [{ scopeId: 'currentScope' }],
  },
  changeScopes: jest.fn(),
};

const mockScopesDashboardsService = {
  state: {
    navigationScope: undefined as string | undefined,
  },
  setNavigationScope: jest.fn(),
};

jest.mock('../ScopesContextProvider', () => ({
  ...jest.requireActual('../ScopesContextProvider'),
  useScopesServices: jest.fn(() => ({
    scopesSelectorService: mockScopesSelectorService,
    scopesDashboardsService: mockScopesDashboardsService,
  })),
}));

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
};

describe('ScopesNavigationTreeLink', () => {
  const mockUseLocation = useLocation as jest.Mock;
  const mockLocationServicePush = locationService.push as jest.Mock;

  beforeEach(() => {
    mockUseLocation.mockReturnValue({ pathname: '/current-path' });
    jest.clearAllMocks();
    mockScopesSelectorService.state.appliedScopes = [{ scopeId: 'currentScope' }];
    mockScopesDashboardsService.state.navigationScope = undefined;
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

  it('shows correct icon for grafana-metricsdrilldown-app with query parameters', () => {
    renderWithRouter(
      <ScopesNavigationTreeLink
        to="/a/grafana-metricsdrilldown-app?from=now-1h&to=now"
        title="Metrics Drilldown"
        id="metrics-drilldown"
      />
    );

    const link = screen.getByTestId('scopes-dashboards-metrics-drilldown');
    // Icon should be rendered (check for SVG element which is how Icon renders)
    const icon = link.querySelector('svg');
    expect(icon).toBeInTheDocument();
    // The link should contain the title text
    expect(link).toHaveTextContent('Metrics Drilldown');
  });

  it('shows correct icon for grafana-metricsdrilldown-app without trailing slash', () => {
    renderWithRouter(
      <ScopesNavigationTreeLink to="/a/grafana-metricsdrilldown-app" title="Metrics Drilldown" id="metrics-drilldown" />
    );

    const link = screen.getByTestId('scopes-dashboards-metrics-drilldown');
    const icon = link.querySelector('svg');
    expect(icon).toBeInTheDocument();
    expect(link).toHaveTextContent('Metrics Drilldown');
  });

  describe('click handler with subScope', () => {
    beforeEach(() => {
      // Mock window.location.origin
      Object.defineProperty(window, 'location', {
        value: {
          origin: 'http://localhost',
        },
        writable: true,
      });
    });

    it('should prevent default navigation when subScope is provided', async () => {
      const user = userEvent.setup();

      renderWithRouter(
        <ScopesNavigationTreeLink to="/test-path" title="Test Link" id="test-id" subScope="subScope1" />
      );

      const link = screen.getByTestId('scopes-dashboards-test-id');
      await user.click(link);

      // Should call changeScopes instead of navigating normally
      expect(mockScopesSelectorService.changeScopes).toHaveBeenCalled();
      expect(mockLocationServicePush).toHaveBeenCalled();
    });

    it('should set navigation scope from current scope when not already set', async () => {
      mockScopesDashboardsService.state.navigationScope = undefined;
      mockScopesSelectorService.state.appliedScopes = [{ scopeId: 'currentScope' }];

      renderWithRouter(
        <ScopesNavigationTreeLink to="/test-path" title="Test Link" id="test-id" subScope="subScope1" />
      );

      const link = screen.getByTestId('scopes-dashboards-test-id');
      await userEvent.click(link);

      expect(mockScopesDashboardsService.setNavigationScope).toHaveBeenCalledWith('currentScope');
    });

    it('should not set navigation scope when already set', async () => {
      mockScopesDashboardsService.state.navigationScope = 'existingNavScope';
      mockScopesSelectorService.state.appliedScopes = [{ scopeId: 'currentScope' }];

      renderWithRouter(
        <ScopesNavigationTreeLink to="/test-path" title="Test Link" id="test-id" subScope="subScope1" />
      );

      const link = screen.getByTestId('scopes-dashboards-test-id');
      await userEvent.click(link);

      // Should not call setNavigationScope with currentScope since it's already set
      expect(mockScopesDashboardsService.setNavigationScope).not.toHaveBeenCalledWith('currentScope');
    });

    it('should call changeScopes with subScope', async () => {
      renderWithRouter(
        <ScopesNavigationTreeLink to="/test-path" title="Test Link" id="test-id" subScope="subScope1" />
      );

      const link = screen.getByTestId('scopes-dashboards-test-id');
      await userEvent.click(link);

      expect(mockScopesSelectorService.changeScopes).toHaveBeenCalledWith(['subScope1'], undefined, undefined, false);
    });

    it('should navigate to URL with updated query params', async () => {
      renderWithRouter(
        <ScopesNavigationTreeLink to="/test-path?existing=param" title="Test Link" id="test-id" subScope="subScope1" />
      );

      const link = screen.getByTestId('scopes-dashboards-test-id');
      await userEvent.click(link);

      expect(mockLocationServicePush).toHaveBeenCalled();
      const pushedUrl = mockLocationServicePush.mock.calls[0][0];
      expect(pushedUrl).toContain('/test-path');
      expect(pushedUrl).toContain('scopes=subScope1');
      expect(pushedUrl).toContain('navigation_scope=currentScope');
    });

    it('should remove scope_node and scope_parent from URL when navigating with subScope', async () => {
      renderWithRouter(
        <ScopesNavigationTreeLink
          to="/test-path?scope_node=node1&scope_parent=parent1"
          title="Test Link"
          id="test-id"
          subScope="subScope1"
        />
      );

      const link = screen.getByTestId('scopes-dashboards-test-id');
      await userEvent.click(link);

      expect(mockLocationServicePush).toHaveBeenCalled();
      const pushedUrl = mockLocationServicePush.mock.calls[0][0];
      expect(pushedUrl).not.toContain('scope_node');
      expect(pushedUrl).not.toContain('scope_parent');
    });

    it('should allow normal navigation when subScope is not provided', async () => {
      const user = userEvent.setup();

      renderWithRouter(<ScopesNavigationTreeLink to="/test-path" title="Test Link" id="test-id" />);

      const link = screen.getByTestId('scopes-dashboards-test-id');
      await user.click(link);

      // Should not call changeScopes or locationService.push when subScope is not provided
      expect(mockScopesSelectorService.changeScopes).not.toHaveBeenCalled();
      expect(mockLocationServicePush).not.toHaveBeenCalled();
    });

    it('should handle URL with existing query params correctly', async () => {
      const user = userEvent.setup();
      mockScopesDashboardsService.state.navigationScope = undefined;
      mockScopesSelectorService.state.appliedScopes = [{ scopeId: 'currentScope' }];

      renderWithRouter(
        <ScopesNavigationTreeLink
          to="/test-path?param1=value1&param2=value2"
          title="Test Link"
          id="test-id"
          subScope="subScope1"
        />
      );

      const link = screen.getByTestId('scopes-dashboards-test-id');
      await user.click(link);

      expect(mockLocationServicePush).toHaveBeenCalled();
      const pushedUrl = mockLocationServicePush.mock.calls[0][0];
      expect(pushedUrl).toContain('scopes=subScope1');
      expect(pushedUrl).toContain('navigation_scope=currentScope');
    });
  });
});
