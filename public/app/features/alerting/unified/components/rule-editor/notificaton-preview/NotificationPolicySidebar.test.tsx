import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { type RouteMatchInfo, type RouteWithID } from '@grafana/alerting';

import { ROOT_ROUTE_NAME } from '../../../utils/k8s/constants';

import { NotificationPolicySidebar } from './NotificationPolicySidebar';

jest.mock('../../../useRouteGroupsMatcher');

const mockRoute = (partial: Partial<RouteWithID> = {}): RouteWithID => ({
  id: 'route-1',
  receiver: 'email',
  routes: [],
  continue: false,
  ...partial,
});

const mockRouteMatchInfo = (route: RouteWithID): RouteMatchInfo<RouteWithID> => ({
  route,
  matchDetails: [],
  matched: true,
});

const singleJourney = [mockRouteMatchInfo(mockRoute())];
const labels: Array<[string, string]> = [['alertname', 'test-alert']];

describe('NotificationPolicySidebar', () => {
  it('renders nothing when journeys is empty', () => {
    const { container } = render(<NotificationPolicySidebar journeys={[]} labels={labels} onClose={jest.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders "Notification policy" title for a single journey', () => {
    render(<NotificationPolicySidebar journeys={[{ journey: singleJourney }]} labels={labels} onClose={jest.fn()} />);
    expect(screen.getByText('Notification policy')).toBeInTheDocument();
  });

  it('renders the policy name in the drawer subtitle for a named single journey', () => {
    render(
      <NotificationPolicySidebar
        journeys={[{ journey: singleJourney, policyName: 'team-a' }]}
        labels={labels}
        onClose={jest.fn()}
      />
    );
    expect(screen.getByText('Notification policy')).toBeInTheDocument();
    // subtitle span contains the bullet + policyName; h2 heading contains just the policyName
    expect(screen.getAllByText(/team-a/)).toHaveLength(2);
  });

  it('normalizes ROOT_ROUTE_NAME to show "Notification policy" without a sub-title', () => {
    render(
      <NotificationPolicySidebar
        journeys={[{ journey: singleJourney, policyName: ROOT_ROUTE_NAME }]}
        labels={labels}
        onClose={jest.fn()}
      />
    );
    expect(screen.getByText('Notification policy')).toBeInTheDocument();
    expect(screen.queryByText(ROOT_ROUTE_NAME)).not.toBeInTheDocument();
  });

  it('renders "Notification policies" title for multiple journeys', () => {
    render(
      <NotificationPolicySidebar
        journeys={[{ journey: singleJourney }, { journey: singleJourney }]}
        labels={labels}
        onClose={jest.fn()}
      />
    );
    expect(screen.getByText('Notification policies')).toBeInTheDocument();
  });

  it('renders "Default policy" for root route when policyName is undefined', () => {
    render(<NotificationPolicySidebar journeys={[{ journey: singleJourney }]} labels={labels} onClose={jest.fn()} />);
    expect(screen.getByRole('heading', { name: 'Default policy' })).toBeInTheDocument();
  });

  it('renders the named policy heading for a named root route', () => {
    render(
      <NotificationPolicySidebar
        journeys={[{ journey: singleJourney, policyName: 'my-team' }]}
        labels={labels}
        onClose={jest.fn()}
      />
    );
    expect(screen.getByRole('heading', { name: 'my-team' })).toBeInTheDocument();
  });

  it('calls onClose when the drawer is closed', async () => {
    const onClose = jest.fn();
    render(<NotificationPolicySidebar journeys={[{ journey: singleJourney }]} labels={labels} onClose={onClose} />);
    await userEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
