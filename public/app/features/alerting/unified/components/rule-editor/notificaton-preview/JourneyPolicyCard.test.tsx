import { render, screen } from '@testing-library/react';

import { LabelMatcher, RouteWithID } from '@grafana/alerting';

import { JourneyPolicyCard } from './JourneyPolicyCard';

describe('JourneyPolicyCard', () => {
  const mockMatchers: LabelMatcher[] = [
    { label: 'severity', type: '=', value: 'critical' },
    { label: 'team', type: '=', value: 'backend' },
  ];

  const mockRoute: RouteWithID = {
    id: 'test-route',
    receiver: 'test-receiver',
    group_by: ['alertname', 'severity'],
    matchers: mockMatchers,
    routes: [],
    continue: false,
  };

  it('should render basic route information', () => {
    render(<JourneyPolicyCard route={mockRoute} />);

    expect(screen.getByText('test-receiver')).toBeInTheDocument();
    expect(screen.getByText('alertname, severity')).toBeInTheDocument();
    expect(screen.getByTestId('label-matchers')).toBeInTheDocument();
  });

  it('should render "No matchers" when route has no matchers', () => {
    const routeWithoutMatchers: RouteWithID = {
      id: 'test-route',
      receiver: 'test-receiver',
      matchers: [],
      routes: [],
      continue: false,
    };

    render(<JourneyPolicyCard route={routeWithoutMatchers} />);

    expect(screen.getByText('No matchers')).toBeInTheDocument();
    expect(screen.queryByTestId('label-matchers')).not.toBeInTheDocument();
  });

  it('should show continue matching indicator when route.continue is true', () => {
    const routeWithContinue: RouteWithID = {
      ...mockRoute,
      continue: true,
    };

    render(<JourneyPolicyCard route={routeWithContinue} />);

    expect(screen.getByTestId('continue-matching')).toBeInTheDocument();
  });

  it('should not show continue matching indicator when route.continue is false or undefined', () => {
    render(<JourneyPolicyCard route={mockRoute} />);

    expect(screen.queryByTestId('continue-matching')).not.toBeInTheDocument();
  });

  it('should not render receiver or group_by when they are not provided', () => {
    const minimalRoute: RouteWithID = {
      id: 'test-route',
      routes: [],
      continue: false,
    };

    render(<JourneyPolicyCard route={minimalRoute} />);

    expect(screen.queryByText(/test-receiver/)).not.toBeInTheDocument();
    expect(screen.queryByText(/alertname/)).not.toBeInTheDocument();
  });

  it('should show DefaultPolicyIndicator when isRoot is true', () => {
    render(<JourneyPolicyCard route={mockRoute} isRoot={true} />);

    expect(screen.getByRole('heading', { name: 'Default policy' })).toBeInTheDocument();
  });

  describe('isFinalRoute prop', () => {
    it('should set aria-current="true" and aria-label when isFinalRoute is true', () => {
      render(<JourneyPolicyCard route={mockRoute} isFinalRoute={true} />);

      const card = screen.getByRole('article', { current: true });
      expect(card).toBeInTheDocument();
    });

    it('should not set aria-current when isFinalRoute is false', () => {
      render(<JourneyPolicyCard route={mockRoute} isFinalRoute={false} />);

      const card = screen.getByRole('article', { current: false });
      expect(card).toBeInTheDocument();
    });

    it('should not set aria-current when isFinalRoute is undefined (default)', () => {
      render(<JourneyPolicyCard route={mockRoute} />);

      const card = screen.getByRole('article', { current: false });
      expect(card).toBeInTheDocument();
    });
  });
});
