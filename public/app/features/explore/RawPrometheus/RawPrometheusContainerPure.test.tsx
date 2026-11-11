import { OpenFeatureProvider } from '@openfeature/react-sdk';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import { type ComponentProps } from 'react';

import { FieldType, InternalTimeZones, toDataFrame, LoadingState } from '@grafana/data';
import { FlagKeys } from '@grafana/runtime/internal';
import { mockClientSize } from '@grafana/test-utils';
import { getTestFeatureFlagClient, setTestFlags } from '@grafana/test-utils/unstable';
import { type TableNG } from '@grafana/ui/unstable';
import { getTemplateSrv } from 'app/features/templating/template_srv';

import { PrometheusQueryResultsContainer } from './PrometheusQueryResultsContainer';

let tableNGTimeZone: string | undefined;
jest.mock('@grafana/ui/unstable', () => {
  const actual = jest.requireActual('@grafana/ui/unstable');
  return {
    ...actual,
    TableNG: (props: ComponentProps<typeof TableNG>) => {
      tableNGTimeZone = props.timeZone;
      return <actual.TableNG {...props} />;
    },
  };
});

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
    // JSDOM reports zero client dimensions, causing react-data-grid to virtualize away the text column.
    mockClientSize({ width: 800, height: 600 });
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

  it('passes query timezone to TableNG for value filtering', async () => {
    renderContainer({ timeZone: 'Pacific/Auckland' });
    await screen.findByRole('grid');
    expect(tableNGTimeZone).toBe('Pacific/Auckland');
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
