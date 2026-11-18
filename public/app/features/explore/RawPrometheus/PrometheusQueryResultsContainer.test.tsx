import { OpenFeatureProvider } from '@openfeature/react-sdk';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

import { FieldType, InternalTimeZones, toDataFrame, LoadingState } from '@grafana/data';
import { mockClientSize } from '@grafana/test-utils';
import { getTestFeatureFlagClient, setTestFlags } from '@grafana/test-utils/unstable';
import { getTemplateSrv } from 'app/features/templating/template_srv';

import { PrometheusQueryResultsContainer } from './PrometheusQueryResultsContainer';

function getTable(): HTMLElement {
  return screen.getAllByRole('grid')[0];
}

function getTableToggle(): HTMLElement {
  return screen.getAllByRole('radio')[0];
}

function getRowsData(rows: HTMLElement[]): Object[] {
  let content = [];
  for (let i = 1; i < rows.length; i++) {
    content.push({
      time: within(rows[i]).getByText(/2021*/).textContent,
      text: within(rows[i]).getByText(/test_string_*/).textContent,
    });
  }
  return content;
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

const renderContainer = (propOverrides = {}) =>
  render(
    <OpenFeatureProvider client={getTestFeatureFlagClient()}>
      <PrometheusQueryResultsContainer {...defaultProps} {...propOverrides} />
    </OpenFeatureProvider>
  );

describe('PrometheusQueryResultsContainer', () => {
  beforeAll(() => {
    // JSDOM reports zero client dimensions, causing react-data-grid to virtualize away the text column.
    mockClientSize({ width: 800, height: 600 });
    getTemplateSrv();
  });

  afterEach(async () => {
    await act(async () => {
      setTestFlags({});
    });
  });

  it('should render table with data and toggle when showRawPrometheus is true', async () => {
    renderContainer({ showRawPrometheus: true });

    // Starts in the Raw view, so wait for the toggle rather than the grid
    await waitFor(() => {
      expect(screen.queryAllByRole('radio').length).toBeGreaterThan(0);
    });

    fireEvent.click(getTableToggle());

    await screen.findAllByRole('columnheader');
    expect(getTable()).toBeInTheDocument();
    const rows = within(getTable()).getAllByRole('row');
    expect(rows).toHaveLength(5);
    expect(getRowsData(rows)).toEqual([
      { time: '2021-01-01 00:00:00', text: 'test_string_1' },
      { time: '2021-01-01 03:00:00', text: 'test_string_2' },
      { time: '2021-01-01 01:00:00', text: 'test_string_3' },
      { time: '2021-01-01 02:00:00', text: 'test_string_4' },
    ]);
  });

  it('should render table without toggle when showRawPrometheus is false', async () => {
    renderContainer({ showRawPrometheus: false });

    // Wait for lazy-loaded component to render
    await waitFor(() => {
      expect(screen.queryAllByRole('grid').length).toBe(1);
    });

    // Toggle should NOT be visible
    expect(screen.queryAllByRole('radio').length).toBe(0);
  });

  it('should render empty state when no data', async () => {
    renderContainer({ tableResult: [], showRawPrometheus: true });

    // Wait for lazy-loaded component to render
    await waitFor(() => {
      expect(screen.getByText('0 series returned')).toBeInTheDocument();
    });
  });

  it('should handle undefined tableResult gracefully', async () => {
    renderContainer({ tableResult: undefined });

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

    renderContainer({ tableResult: [emptyFrame] });

    await waitFor(() => {
      expect(screen.getByText('0 series returned')).toBeInTheDocument();
    });
  });

  it('should use default width and timeZone when not provided', async () => {
    render(
      <OpenFeatureProvider client={getTestFeatureFlagClient()}>
        <PrometheusQueryResultsContainer tableResult={defaultProps.tableResult} />
      </OpenFeatureProvider>
    );

    await waitFor(() => {
      expect(screen.queryAllByRole('grid').length).toBe(1);
    });
  });

  it('should show loading state', async () => {
    renderContainer({ loading: LoadingState.Loading });

    expect(await screen.findByText('test_string_1')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByLabelText('Panel loading bar')).toBeInTheDocument();
    });
  });
});
