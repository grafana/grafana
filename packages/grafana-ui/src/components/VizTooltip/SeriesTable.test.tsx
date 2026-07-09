import { render, screen } from '@testing-library/react';

import { SeriesTable, SeriesTableRow } from './SeriesTable';

describe('SeriesTableRow', () => {
  it('renders the label', () => {
    render(<SeriesTableRow label="My Series" />);
    expect(screen.getByText('My Series')).toBeInTheDocument();
  });

  it('renders the value', () => {
    render(<SeriesTableRow label="Series" value="99.5" />);
    expect(screen.getByText('99.5')).toBeInTheDocument();
  });

  it('renders a SeriesIcon when color is provided', () => {
    render(<SeriesTableRow color="#ff0000" label="Series" />);
    expect(screen.getByTestId('series-icon')).toBeInTheDocument();
  });

  it('does not render a SeriesIcon when color is absent', () => {
    render(<SeriesTableRow label="Series" />);
    expect(screen.queryByTestId('series-icon')).not.toBeInTheDocument();
  });

  it('renders without value when value is absent', () => {
    render(<SeriesTableRow label="Series" />);
    // Should not throw and should render label only
    expect(screen.getByText('Series')).toBeInTheDocument();
  });

  it('renders without label when label is absent', () => {
    render(<SeriesTableRow value="42" />);
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('has the SeriesTableRow testid', () => {
    render(<SeriesTableRow label="A" />);
    expect(screen.getByTestId('SeriesTableRow')).toBeInTheDocument();
  });
});

describe('SeriesTable', () => {
  const series = [
    { label: 'Alpha', color: '#ff0000', value: '10' },
    { label: 'Beta', color: '#00ff00', value: '20', isActive: true },
  ];

  it('renders all series rows', () => {
    render(<SeriesTable series={series} />);
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
  });

  it('renders all series values', () => {
    render(<SeriesTable series={series} />);
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('20')).toBeInTheDocument();
  });

  it('renders the timestamp when provided', () => {
    render(<SeriesTable series={series} timestamp="2024-01-01 12:00" />);
    expect(screen.getByText('2024-01-01 12:00')).toBeInTheDocument();
  });

  it('does not render a timestamp element when timestamp is absent', () => {
    render(<SeriesTable series={series} />);
    expect(screen.queryByLabelText('Timestamp')).not.toBeInTheDocument();
  });

  it('renders the timestamp with accessible label', () => {
    render(<SeriesTable series={series} timestamp="2024-01-01" />);
    expect(screen.getByLabelText('Timestamp')).toBeInTheDocument();
  });

  it('renders an empty list when no series provided', () => {
    const { container } = render(<SeriesTable series={[]} />);
    expect(screen.queryAllByTestId('SeriesTableRow')).toHaveLength(0);
    expect(container).toBeInTheDocument();
  });

  it('renders the correct number of rows', () => {
    render(<SeriesTable series={series} />);
    expect(screen.getAllByTestId('SeriesTableRow')).toHaveLength(2);
  });
});
