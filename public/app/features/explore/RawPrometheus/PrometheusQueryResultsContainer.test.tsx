import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { FieldType, InternalTimeZones, toDataFrame, LoadingState } from '@grafana/data';
import { getTemplateSrv } from 'app/features/templating/template_srv';

import { PrometheusQueryResultsContainer } from './PrometheusQueryResultsContainer';

function getTableToggle(): HTMLElement {
  return screen.getAllByRole('radio')[0];
}

const dataFrame = toDataFrame({
  name: 'A',
  fields: [
    {
      name: 'time',
      type: FieldType.time,
      values: [1609459200000, 1609470000000, 1609462800000, 1609466400000],
      config: {
        custom: {
          filterable: false,
        },
      },
    },
    {
      name: 'text',
      type: FieldType.string,
      values: ['test_string_1', 'test_string_2', 'test_string_3', 'test_string_4'],
      config: {
        custom: {
          filterable: false,
        },
      },
    },
  ],
});

const defaultProps = {
  loading: LoadingState.NotStarted,
  width: 800,
  onCellFilterAdded: jest.fn(),
  tableResult: [dataFrame],
  timeZone: InternalTimeZones.utc,
  showRawPrometheus: false,
};

describe('PrometheusQueryResultsContainer', () => {
  beforeAll(() => {
    getTemplateSrv();
  });

  it('should render table with data and toggle when showRawPrometheus is true', async () => {
    render(<PrometheusQueryResultsContainer {...defaultProps} showRawPrometheus={true} />);

    // showRawPrometheus defaults to the raw view, which renders its own <table>.
    await waitFor(() => {
      expect(screen.queryAllByRole('table').length).toBe(1);
    });

    // Toggle should be visible
    expect(screen.queryAllByRole('radio').length).toBeGreaterThan(0);

    // Switching to the table view swaps the raw <table> for the TableNG data grid.
    fireEvent.click(getTableToggle());

    expect(await screen.findByRole('grid')).toBeInTheDocument();
    expect(screen.queryAllByRole('table')).toHaveLength(0);
  });

  it('should render table without toggle when showRawPrometheus is false', async () => {
    render(<PrometheusQueryResultsContainer {...defaultProps} showRawPrometheus={false} />);

    // Wait for lazy-loaded component to render
    await waitFor(() => {
      expect(screen.queryAllByRole('grid').length).toBe(1);
    });

    // Toggle should NOT be visible
    expect(screen.queryAllByRole('radio').length).toBe(0);
  });

  it('should render empty state when no data', async () => {
    render(<PrometheusQueryResultsContainer {...defaultProps} tableResult={[]} showRawPrometheus={true} />);

    // Wait for lazy-loaded component to render
    await waitFor(() => {
      expect(screen.getByText('0 series returned')).toBeInTheDocument();
    });
  });

  it('should handle undefined tableResult gracefully', async () => {
    render(<PrometheusQueryResultsContainer {...defaultProps} tableResult={undefined} />);

    await waitFor(() => {
      expect(screen.getByText('0 series returned')).toBeInTheDocument();
    });
  });

  it('should handle DataFrame with no rows', async () => {
    const emptyFrame = toDataFrame({
      name: 'Empty',
      fields: [
        { name: 'time', type: FieldType.time, values: [] },
        { name: 'value', type: FieldType.number, values: [] },
      ],
    });

    render(<PrometheusQueryResultsContainer {...defaultProps} tableResult={[emptyFrame]} />);

    await waitFor(() => {
      expect(screen.getByText('0 series returned')).toBeInTheDocument();
    });
  });

  it('should use default width and timeZone when not provided', async () => {
    render(<PrometheusQueryResultsContainer tableResult={defaultProps.tableResult} />);

    await waitFor(() => {
      expect(screen.queryAllByRole('grid').length).toBe(1);
    });
  });

  it('should show loading state', async () => {
    render(<PrometheusQueryResultsContainer {...defaultProps} loading={LoadingState.Loading} />);

    await waitFor(() => {
      expect(screen.getByLabelText('Panel loading bar')).toBeInTheDocument();
    });
  });
});
