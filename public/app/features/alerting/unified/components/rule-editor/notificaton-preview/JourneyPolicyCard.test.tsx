import { render, screen } from '@testing-library/react';

import { type LabelMatcher, type RouteWithID } from '@grafana/alerting';

import { NAMED_ROOT_LABEL_NAME } from '../../notification-policies/useNotificationPolicyRoute';

import { JourneyPolicyCard } from './JourneyPolicyCard';

jest.mock('../../../useRouteGroupsMatcher');

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

  it('should show DefaultPolicyIndicator when isRoot is true and policyName is not provided', () => {
    render(<JourneyPolicyCard route={mockRoute} isRoot={true} />);

    expect(screen.getByRole('heading', { name: 'Default policy' })).toBeInTheDocument();
  });

  it('renders the tree name as heading for a named root route', () => {
    render(<JourneyPolicyCard route={mockRoute} isRoot={true} policyName="team-frontend" />);

    expect(screen.getByRole('heading', { name: 'team-frontend' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Default policy' })).not.toBeInTheDocument();
  });

  it('filters the internal routing matcher from the root card display', () => {
    const routeWithInternalMatcher: RouteWithID = {
      ...mockRoute,
      matchers: [
        { label: NAMED_ROOT_LABEL_NAME, type: '=', value: 'team-a' },
        { label: 'severity', type: '=', value: 'critical' },
      ],
    };
    render(<JourneyPolicyCard route={routeWithInternalMatcher} isRoot={true} />);

    expect(screen.queryByText(NAMED_ROOT_LABEL_NAME)).not.toBeInTheDocument();
    // user-defined matcher is still shown
    expect(screen.getByTestId('label-matchers')).toBeInTheDocument();
  });

  it('does not filter the internal routing matcher from non-root cards', () => {
    const routeWithInternalMatcher: RouteWithID = {
      ...mockRoute,
      matchers: [{ label: NAMED_ROOT_LABEL_NAME, type: '=', value: 'team-a' }],
    };
    render(<JourneyPolicyCard route={routeWithInternalMatcher} isRoot={false} />);

    expect(screen.getByTestId('label-matchers')).toBeInTheDocument();
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
