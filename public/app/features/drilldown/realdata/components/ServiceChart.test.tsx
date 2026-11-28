import { screen } from '@testing-library/react';
import { render } from 'test/test-utils';

import { ServiceChart } from './ServiceChart';

const props = {
  title: 'Traces',
  icon: 'gf-traces' as const,
  subtitle: 'Requests per minute by status',
  emptyText: 'No server or consumer spans for checkout in the last 30 minutes',
  openLabel: 'View traces',
};

const MESSAGES = [props.emptyText, 'Not set up yet', 'Not measured'];

describe('ServiceChart', () => {
  it('says the service has nothing here when the query ran and found nothing', () => {
    render(<ServiceChart {...props} state={{ kind: 'empty' }} />);

    expect(screen.getByText(props.emptyText)).toBeInTheDocument();
  });

  it('says the data source is not set up when none is chosen', () => {
    render(<ServiceChart {...props} state={{ kind: 'no-source' }} />);

    expect(screen.getByText('Not set up yet')).toBeInTheDocument();
    expect(screen.queryByText(props.emptyText)).not.toBeInTheDocument();
  });

  it('says the chart was not measured when the query failed, and does not say the service is missing', () => {
    render(<ServiceChart {...props} state={{ kind: 'error', message: 'Tempo answered 502' }} />);

    expect(screen.getByText('Not measured')).toBeInTheDocument();
    expect(screen.queryByText(props.emptyText)).not.toBeInTheDocument();
  });

  it('says nothing about the service while the query runs', () => {
    render(<ServiceChart {...props} />);

    expect(screen.getByText('Traces')).toBeInTheDocument();
    for (const message of MESSAGES) {
      expect(screen.queryByText(message)).not.toBeInTheDocument();
    }
  });

  it('shows no message when there is data', () => {
    render(<ServiceChart {...props} state={{ kind: 'data', series: [{ name: 'ok', times: [60000], values: [3] }] }} />);

    expect(screen.getByText('Requests per minute by status')).toBeInTheDocument();
    for (const message of MESSAGES) {
      expect(screen.queryByText(message)).not.toBeInTheDocument();
    }
  });

  it('opens the Drilldown app for the service from the header', () => {
    render(<ServiceChart {...props} state={{ kind: 'empty' }} openUrl="/a/grafana-exploretraces-app/explore" />);

    expect(screen.getByRole('link', { name: 'View traces' })).toHaveAttribute(
      'href',
      '/a/grafana-exploretraces-app/explore'
    );
  });

  it('has no header action when the app has no URL', () => {
    render(<ServiceChart {...props} state={{ kind: 'empty' }} />);

    expect(screen.queryByRole('link', { name: 'View traces' })).not.toBeInTheDocument();
  });
});
