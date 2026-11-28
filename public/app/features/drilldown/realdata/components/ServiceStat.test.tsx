import { screen } from '@testing-library/react';
import { render } from 'test/test-utils';

import { type ChartState } from '../serviceCharts';

import { ServiceStat } from './ServiceStat';

const props = {
  icon: 'gf-logs' as const,
  title: 'Logs',
  caption: 'Error lines per minute',
  format: (value: number) => `${Math.round(value)} per minute`,
  emptyText: 'No log lines with service_name="checkout" in the last 30 minutes',
  appName: 'Logs',
};

const MESSAGES = [props.emptyText, 'Not set up yet', 'Not measured'];

const data = (values: number[]): ChartState => ({
  kind: 'data',
  series: [{ name: 'errors', times: values.map((_, index) => (index + 1) * 60000), values }],
});

describe('ServiceStat', () => {
  it('shows the latest value, with what it counts under it', () => {
    render(<ServiceStat {...props} state={data([3, 110])} />);

    expect(screen.getByText('110 per minute')).toBeInTheDocument();
    expect(screen.getByText('Error lines per minute')).toBeInTheDocument();
    for (const message of MESSAGES) {
      expect(screen.queryByText(message)).not.toBeInTheDocument();
    }
  });

  it('takes the latest value that is a number', () => {
    render(<ServiceStat {...props} state={data([5, NaN])} />);

    expect(screen.getByText('5 per minute')).toBeInTheDocument();
  });

  it('asks the tone for the latest value', () => {
    const tone = jest.fn().mockReturnValue('error');

    render(<ServiceStat {...props} state={data([3, 110])} tone={tone} />);

    expect(tone).toHaveBeenCalledWith(110);
  });

  it('says the service has nothing here when the query ran and found nothing', () => {
    render(<ServiceStat {...props} state={{ kind: 'empty' }} />);

    expect(screen.getByText(props.emptyText)).toBeInTheDocument();
    expect(screen.queryByText('Error lines per minute')).not.toBeInTheDocument();
  });

  it('says the data source is not set up when none is chosen', () => {
    render(<ServiceStat {...props} state={{ kind: 'no-source' }} />);

    expect(screen.getByText('Not set up yet')).toBeInTheDocument();
    expect(screen.queryByText(props.emptyText)).not.toBeInTheDocument();
  });

  it('says the value was not measured when the query failed, and does not say the service is missing', () => {
    render(<ServiceStat {...props} state={{ kind: 'error', message: 'Loki answered 502' }} />);

    expect(screen.getByText('Not measured')).toBeInTheDocument();
    expect(screen.queryByText(props.emptyText)).not.toBeInTheDocument();
  });

  it('says nothing about the service while the query runs', () => {
    render(<ServiceStat {...props} />);

    expect(screen.getByText('Logs')).toBeInTheDocument();
    for (const message of MESSAGES) {
      expect(screen.queryByText(message)).not.toBeInTheDocument();
    }
  });

  it('has an arrow that opens the Drilldown app for the service', () => {
    render(<ServiceStat {...props} state={data([1])} openUrl="/a/grafana-lokiexplore-app/explore" />);

    expect(screen.getByRole('link', { name: 'Open in Logs' })).toHaveAttribute(
      'href',
      '/a/grafana-lokiexplore-app/explore'
    );
  });

  it('has no arrow when the app has no URL', () => {
    render(<ServiceStat {...props} state={data([1])} />);

    expect(screen.queryByRole('link', { name: /^Open in/ })).not.toBeInTheDocument();
  });
});
