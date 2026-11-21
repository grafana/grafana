import { render, screen } from '@testing-library/react';

import { locationService } from '@grafana/runtime';

import { FailedOrdersPanel, SlowQueriesPanel } from './SqlPanels';

const PANELS = [
  { title: 'Failed orders', Panel: FailedOrdersPanel },
  { title: 'Slowest queries', Panel: SlowQueriesPanel },
];

describe('the SQL evidence panels', () => {
  beforeEach(() => {
    locationService.replace('/drilldown');
  });

  it.each(PANELS)('$title says no SQL data source is connected until one is chosen', ({ Panel }) => {
    render(<Panel />);

    expect(screen.getByText('No SQL data source connected.')).toBeInTheDocument();
  });

  it.each(PANELS)('$title says a chosen SQL data source is not queried yet', ({ Panel }) => {
    locationService.push('/drilldown?var-ds-sql=orders');

    render(<Panel />);

    expect(screen.getByText('A SQL data source is selected, but nothing queries it yet.')).toBeInTheDocument();
  });
});
