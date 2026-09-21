import { OpenFeatureProvider } from '@openfeature/react-sdk';
import { act, render, screen, waitFor, within } from '@testing-library/react';

import { FieldType, InternalTimeZones, toDataFrame, LoadingState } from '@grafana/data';
import { FlagKeys } from '@grafana/runtime/internal';
import { getTestFeatureFlagClient, setTestFlags } from '@grafana/test-utils/unstable';
import { getTemplateSrv } from 'app/features/templating/template_srv';

import { PrometheusQueryResultsContainer } from './PrometheusQueryResultsContainer';

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

// PrometheusQueryResultsContainer applies field overrides (display fns) before handing data down to
// RawPrometheusContainerPure, which TableNG's cell renderers require - toDataFrame() alone isn't enough.
const renderContainer = (propOverrides = {}) =>
  render(
    <OpenFeatureProvider client={getTestFeatureFlagClient()}>
      <PrometheusQueryResultsContainer {...defaultProps} {...propOverrides} />
    </OpenFeatureProvider>
  );

describe('RawPrometheusContainerPure with rawPrometheus.tableNg', () => {
  beforeAll(() => {
    getTemplateSrv();
  });

  beforeEach(async () => {
    // setTestFlags fires OpenFeature events that update React state; wrap in act() since a
    // component from the previous test may still be mounted when this runs.
    await act(async () => {
      setTestFlags({ [FlagKeys.RawPrometheusTableNg]: true });
    });
  });

  afterEach(async () => {
    await act(async () => {
      setTestFlags({});
    });
  });

  it('renders the table data via TableNG', async () => {
    renderContainer();

    await waitFor(() => {
      expect(screen.getByText('test_string_1')).toBeInTheDocument();
    });
    expect(screen.getByText('test_string_2')).toBeInTheDocument();
  });

  it('renders via react-data-grid (TableNG), not the legacy Table', async () => {
    renderContainer();

    await waitFor(() => {
      expect(screen.getByText('test_string_1')).toBeInTheDocument();
    });

    expect(within(screen.getByRole('grid')).getAllByRole('row').length).toBeGreaterThan(0);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('still renders the Raw toggle when showRawPrometheus is true', async () => {
    renderContainer({ showRawPrometheus: true });

    await waitFor(() => {
      expect(screen.queryAllByRole('radio').length).toBeGreaterThan(0);
    });
  });
});
