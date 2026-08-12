import { render, screen, waitFor, within } from '@testing-library/react';

import { FieldType, InternalTimeZones, toDataFrame, LoadingState } from '@grafana/data';
import { useFlagRawPrometheusTableNg } from '@grafana/runtime/internal';
import { getTemplateSrv } from 'app/features/templating/template_srv';

import { PrometheusQueryResultsContainer } from './PrometheusQueryResultsContainer';

// PrometheusQueryResultsContainer applies field overrides (display fns) before handing data down to
// RawPrometheusContainerPure, which TableNG's cell renderers require - toDataFrame() alone isn't enough.
jest.mock('@grafana/runtime/internal', () => ({
  ...jest.requireActual('@grafana/runtime/internal'),
  useFlagRawPrometheusTableNg: jest.fn(),
}));

const mockUseFlagRawPrometheusTableNg = jest.mocked(useFlagRawPrometheusTableNg);

const dataFrame = toDataFrame({
  name: 'A',
  fields: [
    {
      name: 'time',
      type: FieldType.time,
      values: [1609459200000, 1609470000000],
      config: { custom: { filterable: false } },
    },
    {
      name: 'text',
      type: FieldType.string,
      values: ['test_string_1', 'test_string_2'],
      config: { custom: { filterable: false } },
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

describe('RawPrometheusContainerPure with rawPrometheus.tableNg', () => {
  beforeAll(() => {
    getTemplateSrv();
  });

  beforeEach(() => {
    mockUseFlagRawPrometheusTableNg.mockReturnValue(true);
  });

  it('renders the table data via TableNG', async () => {
    render(<PrometheusQueryResultsContainer {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('test_string_1')).toBeInTheDocument();
    });
    expect(screen.getByText('test_string_2')).toBeInTheDocument();
  });

  it('renders via react-data-grid (TableNG), not the legacy Table', async () => {
    render(<PrometheusQueryResultsContainer {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('test_string_1')).toBeInTheDocument();
    });

    expect(within(screen.getByRole('grid')).getAllByRole('row').length).toBeGreaterThan(0);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('still renders the Raw toggle when showRawPrometheus is true', async () => {
    render(<PrometheusQueryResultsContainer {...defaultProps} showRawPrometheus={true} />);

    await waitFor(() => {
      expect(screen.queryAllByRole('radio').length).toBeGreaterThan(0);
    });
  });
});
